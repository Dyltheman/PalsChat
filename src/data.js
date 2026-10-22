import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  startAt,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'

const users = () => collection(db, 'users')
const usernames = () => collection(db, 'usernames')
const requests = () => collection(db, 'friendRequests')
const friendships = () => collection(db, 'friendships')
const conversations = () => collection(db, 'conversations')

export function normalizeUsername(value) {
  return value.trim().toLowerCase()
}

export function validateUsername(value) {
  const normalized = normalizeUsername(value)
  return /^[a-z0-9_]{3,20}$/.test(normalized)
    ? ''
    : 'Use 3-20 letters, numbers, or underscores.'
}

function pairId(firstUid, secondUid) {
  return [firstUid, secondUid].sort().join('~')
}

function conversationId(firstUid, secondUid) {
  return pairId(firstUid, secondUid)
}

function requestId(senderUid, receiverUid) {
  return pairId(senderUid, receiverUid)
}

function asProfile(snapshot) {
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null
}

export async function createProfile(uid, { displayName, username, photoURL = '', status = '' }) {
  const normalizedUsername = normalizeUsername(username)
  const validationError = validateUsername(username)
  if (validationError) throw new Error(validationError)
  const profileRef = doc(users(), uid)
  const usernameRef = doc(usernames(), normalizedUsername)

  await runTransaction(db, async (transaction) => {
    const [profileSnapshot, usernameSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(usernameRef),
    ])
    if (profileSnapshot.exists()) throw new Error('Your profile is already set up.')
    if (usernameSnapshot.exists()) throw new Error('That username is already taken.')
    transaction.set(usernameRef, { uid, createdAt: serverTimestamp() })
    transaction.set(profileRef, {
      displayName: displayName.trim().slice(0, 40),
      username: normalizedUsername,
      photoURL: photoURL.trim().slice(0, 500),
      status: status.trim().slice(0, 100),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    })
  })
}

export async function updateProfile(uid, currentProfile, updates) {
  const displayName = updates.displayName.trim().slice(0, 40)
  const status = updates.status.trim().slice(0, 100)
  const photoURL = updates.photoURL.trim().slice(0, 500)
  const newUsername = normalizeUsername(updates.username)
  const validationError = validateUsername(newUsername)
  if (validationError) throw new Error(validationError)

  const profileRef = doc(users(), uid)
  const oldUsernameRef = doc(usernames(), currentProfile.username)
  const newUsernameRef = doc(usernames(), newUsername)

  await runTransaction(db, async (transaction) => {
    const [profileSnapshot, newUsernameSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(newUsernameRef),
    ])
    if (!profileSnapshot.exists()) throw new Error('Profile not found.')
    if (newUsername !== currentProfile.username && newUsernameSnapshot.exists()) {
      throw new Error('That username is already taken.')
    }
    if (newUsername !== currentProfile.username) {
      transaction.set(newUsernameRef, { uid, createdAt: serverTimestamp() })
      transaction.delete(oldUsernameRef)
    }
    transaction.update(profileRef, {
      displayName,
      username: newUsername,
      photoURL,
      status,
      updatedAt: serverTimestamp(),
    })
  })
}

export async function getProfile(uid) {
  return asProfile(await getDoc(doc(users(), uid)))
}

export function subscribeProfile(uid, onValue, onError) {
  return onSnapshot(doc(users(), uid), (snapshot) => onValue(asProfile(snapshot)), onError)
}

export async function searchUsers(searchText, currentUid) {
  const normalized = normalizeUsername(searchText).replace(/^@/, '').slice(0, 20)
  if (!/^[a-z0-9_]{1,20}$/.test(normalized)) return []

  const queryForPrefix = query(
    usernames(),
    orderBy('__name__'),
    startAt(normalized),
    endAt(`${normalized}\uf8ff`),
  )

  const snapshot = await getDocs(queryForPrefix)
  const matches = snapshot.docs
    .map((usernameSnapshot) => usernameSnapshot.data().uid)
    .filter((uid) => uid && uid !== currentUid)

  const profiles = await Promise.all(matches.map((uid) => getProfile(uid)))
  return profiles.filter(Boolean)
}

export async function sendFriendRequest(senderUid, receiverUid) {
  if (senderUid === receiverUid) throw new Error('You cannot add yourself.')
  const requestRef = doc(requests(), requestId(senderUid, receiverUid))
  const friendshipRef = doc(friendships(), pairId(senderUid, receiverUid))

  await runTransaction(db, async (transaction) => {
    const [requestSnapshot, friendshipSnapshot] = await Promise.all([
      transaction.get(requestRef), transaction.get(friendshipRef),
    ])
    if (friendshipSnapshot.exists()) throw new Error('You are already friends.')
    if (requestSnapshot.exists() && requestSnapshot.data().status === 'pending') {
      throw new Error(requestSnapshot.data().senderUid === senderUid
        ? 'Your request is already pending.'
        : 'This person has already sent you a request.')
    }
    transaction.set(requestRef, {
      senderUid,
      receiverUid,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function respondToFriendRequest(request, accept) {
  const requestRef = doc(requests(), request.id)
  const friendshipRef = doc(friendships(), pairId(request.senderUid, request.receiverUid))

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requestRef)
    if (!snapshot.exists() || snapshot.data().status !== 'pending') {
      throw new Error('This request is no longer pending.')
    }
    if (accept) {
      transaction.set(friendshipRef, {
        participantUids: [request.senderUid, request.receiverUid].sort(),
        createdAt: serverTimestamp(),
      })
      transaction.update(requestRef, { status: 'accepted', updatedAt: serverTimestamp() })
    } else {
      transaction.update(requestRef, { status: 'declined', updatedAt: serverTimestamp() })
    }
  })
}

export async function cancelFriendRequest(request) {
  await runTransaction(db, async (transaction) => {
    const ref = doc(requests(), request.id)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists() || snapshot.data().status !== 'pending') {
      throw new Error('This request is no longer pending.')
    }
    transaction.update(ref, { status: 'cancelled', updatedAt: serverTimestamp() })
  })
}

export function subscribeFriendRequests(uid, onValue, onError) {
  const incoming = query(requests(), where('receiverUid', '==', uid), where('status', '==', 'pending'))
  const outgoing = query(requests(), where('senderUid', '==', uid), where('status', '==', 'pending'))
  let incomingItems = []
  let outgoingItems = []
  let incomingReady = false
  let outgoingReady = false
  const emit = () => {
    if (incomingReady && outgoingReady) onValue({ incoming: incomingItems, outgoing: outgoingItems })
  }
  const unsubIncoming = onSnapshot(incoming, async (snapshot) => {
    incomingItems = await Promise.all(snapshot.docs.map(async (requestSnapshot) => ({
      id: requestSnapshot.id,
      ...requestSnapshot.data(),
      profile: await getProfile(requestSnapshot.data().senderUid),
    })))
    incomingReady = true
    emit()
  }, onError)
  const unsubOutgoing = onSnapshot(outgoing, async (snapshot) => {
    outgoingItems = await Promise.all(snapshot.docs.map(async (requestSnapshot) => ({
      id: requestSnapshot.id,
      ...requestSnapshot.data(),
      profile: await getProfile(requestSnapshot.data().receiverUid),
    })))
    outgoingReady = true
    emit()
  }, onError)
  return () => {
    unsubIncoming()
    unsubOutgoing()
  }
}

export function subscribeFriends(uid, onValue, onError) {
  return onSnapshot(query(friendships(), where('participantUids', 'array-contains', uid)), async (snapshot) => {
    const friends = await Promise.all(snapshot.docs.map(async (friendshipSnapshot) => {
      const friendUid = friendshipSnapshot.data().participantUids.find((participantUid) => participantUid !== uid)
      return getProfile(friendUid)
    }))
    onValue(friends.filter(Boolean))
  }, onError)
}

export async function getOrCreateConversation(uid, friendUid) {
  const id = conversationId(uid, friendUid)
  const conversationRef = doc(conversations(), id)
  const friendshipRef = doc(friendships(), pairId(uid, friendUid))

  await runTransaction(db, async (transaction) => {
    const [conversationSnapshot, friendshipSnapshot] = await Promise.all([
      transaction.get(conversationRef),
      transaction.get(friendshipRef),
    ])
    if (!friendshipSnapshot.exists()) throw new Error('You can only chat with an accepted friend.')
    if (!conversationSnapshot.exists()) {
      transaction.set(conversationRef, {
        participantUids: [uid, friendUid].sort(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastMessagePreview: '',
      })
    }
  })
  return id
}

export function subscribeConversations(uid, onValue, onError) {
  return onSnapshot(query(
    conversations(),
    where('participantUids', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc'),
    limit(50),
  ), async (snapshot) => {
    const items = await Promise.all(snapshot.docs.map(async (conversationSnapshot) => {
      const conversation = conversationSnapshot.data()
      const friendUid = conversation.participantUids.find((participantUid) => participantUid !== uid)
      return {
        id: conversationSnapshot.id,
        ...conversation,
        friend: await getProfile(friendUid),
      }
    }))
    onValue(items)
  }, onError)
}

export function subscribeMessages(conversationIdValue, onValue, onError) {
  return onSnapshot(query(
    collection(doc(conversations(), conversationIdValue), 'messages'),
    orderBy('createdAt', 'desc'),
    limit(40),
  ), (snapshot) => {
    onValue(snapshot.docs.map((messageSnapshot) => ({
      id: messageSnapshot.id,
      ...messageSnapshot.data(),
      snapshot: messageSnapshot,
    })))
  }, onError)
}

export async function loadOlderMessages(conversationIdValue, oldestMessage) {
  if (!oldestMessage?.snapshot) return []
  const snapshot = await getDocs(query(
    collection(doc(conversations(), conversationIdValue), 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(oldestMessage.snapshot),
    limit(40),
  ))
  return snapshot.docs.reverse().map((messageSnapshot) => ({
    id: messageSnapshot.id,
    ...messageSnapshot.data(),
    snapshot: messageSnapshot,
  }))
}

export async function sendMessage(conversationIdValue, senderUid, value) {
  const text = value.trim()
  if (!text) return
  if (text.length > 4000) throw new Error('Messages must be 4,000 characters or fewer.')
  const conversationRef = doc(conversations(), conversationIdValue)
  const messageRef = doc(collection(conversationRef, 'messages'))
  const batch = writeBatch(db)
  batch.set(messageRef, { senderUid, text, createdAt: serverTimestamp() })
  batch.update(conversationRef, {
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: text.slice(0, 120),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}