import { useEffect, useMemo, useRef, useState } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, CircleHelp, LogOut, MessageCircle, Moon, MoreHorizontal, Search, Send, Settings2, Sun, UserRoundPlus, UsersRound, X } from 'lucide-react'
import { auth, firebaseConfigured } from './firebase.js'
import { cancelFriendRequest, createProfile, getOrCreateConversation, loadOlderMessages, respondToFriendRequest, searchUsers, sendFriendRequest, sendMessage, subscribeConversations, subscribeFriendRequests, subscribeFriends, subscribeMessages, subscribeProfile, updateProfile } from './data.js'

const authMessage = (error) => ({
  'auth/invalid-credential': 'That email and password do not match.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a little and try again.',
  'auth/network-request-failed': 'Network trouble. Check your connection and try again.',
}[error.code] || error.message || 'Something went wrong. Please try again.')

function Avatar({ profile, className = '' }) {
  const initials = (profile?.displayName || profile?.username || '?').split(/[\s_]+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return <span className={`avatar ${className}`}>{profile?.photoURL ? <img src={profile.photoURL} alt="" /> : initials}</span>
}

function LoadingScreen() {
  return <main className="loading-screen" role="status"><span className="spinner" />Loading PalsChat</main>
}

function ConfigScreen() {
  return <main className="config-screen"><div className="brand-mark">p</div><p className="eyebrow">YOUR OWN LITTLE CORNER</p><h1>Let’s get<br />your place ready.</h1><p className="config-copy">PalsChat needs the public Firebase web settings from your project before anyone can sign in.</p><div className="config-note"><strong>Next step</strong><span>Copy <code>.env.example</code> to <code>.env.local</code>, fill in the Firebase Web App values, then restart the dev server.</span></div></main>
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'register') await createUserWithEmailAndPassword(auth, email.trim(), password)
      else if (mode === 'reset') { await sendPasswordResetEmail(auth, email.trim()); setNotice('Password reset email sent. Check your inbox.') }
      else await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (authError) { setError(authMessage(authError)) } finally { setBusy(false) }
  }
  const heading = mode === 'register' ? 'Make yourself at home.' : mode === 'reset' ? 'Find your way back.' : 'Good to see you.'
  const subheading = mode === 'register' ? 'A name, a username, and you’re in.' : mode === 'reset' ? 'We’ll send a reset link to your email.' : 'Your people are right here.'
  return <main className="auth-layout">
    <section className="auth-art" aria-label="PalsChat"><div className="auth-art-top"><div className="brand-mark">p</div><span>PalsChat</span></div><div className="art-message"><span className="art-spark" aria-hidden="true">✳</span><p>Some things are<br />better <em>together.</em></p><div className="art-people" aria-hidden="true"><span>m</span><span>j</span><span>a</span><span>+</span></div></div><span className="art-caption">A private place for your favorite people.</span></section>
    <section className="auth-panel"><div className="auth-form-wrap"><span className="mobile-brand"><span className="brand-mark">p</span>PalsChat</span><p className="eyebrow">YOUR FRIENDS ARE HERE</p><h1>{heading}</h1><p className="auth-subtitle">{subheading}</p>
      <form onSubmit={submit} className="auth-form"><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        {mode !== 'reset' && <><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></>}
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'register' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}{!busy && <ArrowUpRight size={17} />}</button></form>
      <div className="auth-links">{mode === 'login' && <button type="button" className="text-button" onClick={() => { setMode('reset'); setError(''); setNotice('') }}>Forgot password?</button>}{mode === 'reset' && <button type="button" className="text-button" onClick={() => { setMode('login'); setError(''); setNotice('') }}>Back to sign in</button>}{mode !== 'reset' && <p>{mode === 'register' ? 'Already have an account?' : 'New to PalsChat?'} <button type="button" className="text-button strong" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError('') }}>{mode === 'register' ? 'Sign in' : 'Create an account'}</button></p>}</div>
    </div><span className="auth-footnote"><CircleHelp size={14} /> Your email is never shown to other members.</span></section>
  </main>
}

function ProfileSetup({ user }) {
  const [displayName, setDisplayName] = useState(user.displayName || user.email?.split('@')[0] || '')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { await createProfile(user.uid, { displayName, username }) } catch (profileError) { setError(profileError.message || 'Could not create your profile.') } finally { setBusy(false) }
  }
  return <main className="profile-setup-page"><div className="setup-card"><div className="brand-mark">p</div><p className="eyebrow">ONE LAST THING</p><h1>What should your friends call you?</h1><p className="auth-subtitle">Pick a name and a unique username people can find.</p><form className="auth-form" onSubmit={submit}><label htmlFor="setup-name">Display name</label><input id="setup-name" autoComplete="name" maxLength={40} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /><label htmlFor="setup-username">Username</label><div className="username-input"><span>@</span><input id="setup-username" autoComplete="username" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="yourname" /></div><span className="field-hint">3-20 letters, numbers, or underscores</span>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Setting up…' : 'Finish setup'}<ArrowUpRight size={17} /></button></form></div></main>
}

function timeLabel(timestamp, date = false) {
  if (!timestamp?.toDate) return ''
  const value = timestamp.toDate()
  return date && value.toDateString() !== new Date().toDateString()
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(value)
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(value)
}

function Sidebar({ profile, activeTab, setActiveTab, conversations, friends, activeId, openConversation, requestCount, theme, toggleTheme, onSignOut }) {
  const tabs = [{ id: 'chats', label: 'Messages', Icon: MessageCircle }, { id: 'people', label: 'Find people', Icon: UserRoundPlus }, { id: 'requests', label: 'Requests', Icon: UsersRound }, { id: 'profile', label: 'Your profile', Icon: Settings2 }]
  return <aside className="sidebar"><div className="sidebar-brand"><div className="brand-mark">p</div><span>PalsChat</span><span className="brand-dot" /></div>
    <nav className="sidebar-nav" aria-label="Main navigation">{tabs.map(({ id, label, Icon }) => <button key={id} type="button" className={`nav-link ${activeTab === id ? 'selected' : ''}`} onClick={() => setActiveTab(id)} aria-current={activeTab === id ? 'page' : undefined}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{id === 'requests' && requestCount > 0 && <span className="nav-count">{requestCount}</span>}</button>)}</nav>
    <div className="side-section-heading"><span>{activeTab === 'people' ? 'FRIENDS' : 'RECENT'}</span>{activeTab === 'people' && <span>{friends.length}</span>}</div>
    <div className="conversation-list">{activeTab === 'people' ? friends.length ? friends.map((friend) => <button className="conversation-row" key={friend.uid} onClick={() => openConversation(friend)} type="button"><Avatar profile={friend} /><span className="conversation-person"><strong>{friend.displayName}</strong><small>@{friend.username}</small></span><ChevronRight size={15} className="row-chevron" /></button>) : <p className="sidebar-empty">Your friends will show up here.</p> : activeTab === 'chats' ? conversations.length ? conversations.map((conversation) => <button key={conversation.id} type="button" className={`conversation-row ${activeId === conversation.id ? 'active' : ''}`} onClick={() => openConversation(conversation.friend, conversation.id)}><Avatar profile={conversation.friend} /><span className="conversation-person"><strong>{conversation.friend?.displayName || 'Friend'}</strong><small>{conversation.lastMessagePreview || `@${conversation.friend?.username || ''}`}</small></span><span className="conversation-time">{timeLabel(conversation.lastMessageAt, true)}</span></button>) : <p className="sidebar-empty">Start a chat with someone you know.</p> : <p className="sidebar-empty">Your conversations will show up here.</p>}</div>
    <div className="sidebar-bottom"><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}<span>{theme === 'light' ? 'Night mode' : 'Day mode'}</span></button><div className="sidebar-profile"><Avatar profile={profile} /><button type="button" className="profile-summary" onClick={() => setActiveTab('profile')}><strong>{profile.displayName}</strong><small>@{profile.username}</small></button><button type="button" className="icon-button signout-button" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></div></div>
  </aside>
}

function EmptyChat({ onFindPeople }) {
  return <div className="empty-chat"><div className="empty-art"><span className="empty-orbit orbit-one" /><span className="empty-orbit orbit-two" /><MessageCircle size={37} strokeWidth={1.3} /></div><p className="eyebrow">YOUR LITTLE CORNER</p><h2>Good conversations<br />start with hello.</h2><p>Choose a friend or find someone new to start a private chat.</p><button type="button" className="subtle-button" onClick={onFindPeople}>Find your people <ArrowUpRight size={16} /></button></div>
}

function PeoplePanel({ user, friends, requests, onOpenConversation, notify }) {
  const [term, setTerm] = useState(''); const [results, setResults] = useState([]); const [searching, setSearching] = useState(false); const [searched, setSearched] = useState(false)
  async function search(event) {
    event.preventDefault(); if (term.trim().replace(/^@/, '').length < 2) return
      event.preventDefault(); if (term.trim().replace(/^@/, '').length < 3) return
      return <section className="content-panel people-panel"><div className="panel-heading"><div><p className="eyebrow">GROW YOUR CIRCLE</p><h1>Find your people</h1><p>Search by username to find a friend.</p></div><span className="heading-illustration"><Search size={24} /></span></div><form className="people-search" onSubmit={search}><Search size={18} aria-hidden="true" /><input aria-label="Search username" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Try a username" /><button type="submit" className="primary-button" disabled={searching || term.trim().length < 3}>{searching ? 'Searching…' : 'Search'}</button></form><div className="people-results" aria-live="polite">{searched ? results.length ? results.map((person) => <div className="person-result" key={person.uid}><Avatar profile={person} className="avatar-large" /><span className="person-result-info"><strong>{person.displayName}</strong><small>@{person.username}</small>{person.status && <small className="person-status">{person.status}</small>}</span>{actionFor(person)}</div>) : <div className="inline-empty"><span className="inline-empty-icon"><Search size={19} /></span><strong>No one by that name yet</strong><span>Check the spelling and try again.</span></div> : <div className="search-hint"><span className="search-hint-icon"><UserRoundPlus size={18} /></span><div><strong>Know their username?</strong><span>Search by exact username or the first few letters.</span></div></div>}</div></section>
    setSearching(true); setSearched(true)
    try { setResults(await searchUsers(term, user.uid)) } catch (error) { notify(error.message || 'Could not search usernames.') } finally { setSearching(false) }
  }
  async function addFriend(person) {
    try { await sendFriendRequest(user.uid, person.uid); notify(`Request sent to ${person.displayName}.`, 'success') } catch (error) { notify(error.message || 'Could not send friend request.') }
  }
  function actionFor(person) {
    if (friends.some((friend) => friend.uid === person.uid)) return <button className="small-action" type="button" onClick={() => onOpenConversation(person)}>Message <ArrowUpRight size={14} /></button>
    if (requests.incoming.some((request) => request.senderUid === person.uid)) return <span className="state-label">Sent you a request</span>
    if (requests.outgoing.some((request) => request.receiverUid === person.uid)) return <span className="state-label pending-label">Pending</span>
    return <button className="small-action" type="button" onClick={() => addFriend(person)}>Add friend <UserRoundPlus size={14} /></button>
  }
  return <section className="content-panel people-panel"><div className="panel-heading"><div><p className="eyebrow">GROW YOUR CIRCLE</p><h1>Find your people</h1><p>Search by username to find a friend.</p></div><span className="heading-illustration"><Search size={24} /></span></div><form className="people-search" onSubmit={search}><Search size={18} aria-hidden="true" /><input aria-label="Search username" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Try a username" /><button type="submit" className="primary-button" disabled={searching || term.trim().length < 2}>{searching ? 'Searching…' : 'Search'}</button></form><div className="people-results" aria-live="polite">{searched ? results.length ? results.map((person) => <div className="person-result" key={person.uid}><Avatar profile={person} className="avatar-large" /><span className="person-result-info"><strong>{person.displayName}</strong><small>@{person.username}</small>{person.status && <small className="person-status">{person.status}</small>}</span>{actionFor(person)}</div>) : <div className="inline-empty"><span className="inline-empty-icon"><Search size={19} /></span><strong>No one by that name yet</strong><span>Check the spelling and try again.</span></div> : <div className="search-hint"><span className="search-hint-icon"><UserRoundPlus size={18} /></span><div><strong>Know their username?</strong><span>Search by exact username or the first few letters.</span></div></div>}</div></section>
}

function RequestsPanel({ requests, notify }) {
  async function respond(request, accept) {
    try { await respondToFriendRequest(request, accept); notify(accept ? `You and ${request.profile?.displayName} are friends now.` : 'Request declined.', 'success') } catch (error) { notify(error.message || 'Could not update this request.') }
  }
  async function cancel(request) {
    try { await cancelFriendRequest(request); notify('Request cancelled.', 'success') } catch (error) { notify(error.message || 'Could not cancel this request.') }
  }
  return <section className="content-panel requests-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR CONNECTIONS</p><h1>Friend requests</h1><p>Say yes to the people you know.</p></div><span className="heading-illustration"><UsersRound size={24} /></span></div><div className="request-section"><div className="section-title"><h2>Received</h2><span>{requests.incoming.length}</span></div>{requests.incoming.length ? requests.incoming.map((request) => <div className="person-result" key={request.id}><Avatar profile={request.profile} className="avatar-large" /><span className="person-result-info"><strong>{request.profile?.displayName || 'PalsChat member'}</strong><small>@{request.profile?.username || 'unknown'}</small></span><div className="request-actions"><button type="button" className="icon-action accept-action" aria-label={`Accept ${request.profile?.displayName || ''}`} onClick={() => respond(request, true)}><Check size={17} /></button><button type="button" className="icon-action decline-action" aria-label={`Decline ${request.profile?.displayName || ''}`} onClick={() => respond(request, false)}><X size={17} /></button></div></div>) : <p className="quiet-empty">No new requests. You’re all caught up.</p>}</div><div className="request-section outgoing-section"><div className="section-title"><h2>Sent</h2><span>{requests.outgoing.length}</span></div>{requests.outgoing.length ? requests.outgoing.map((request) => <div className="person-result" key={request.id}><Avatar profile={request.profile} className="avatar-large" /><span className="person-result-info"><strong>{request.profile?.displayName || 'PalsChat member'}</strong><small>@{request.profile?.username || 'unknown'}</small></span><div className="request-actions"><span className="state-label pending-label">Pending</span><button type="button" className="icon-action decline-action" aria-label={`Cancel request to ${request.profile?.displayName || ''}`} onClick={() => cancel(request)}><X size={17} /></button></div></div>) : <p className="quiet-empty">Requests you send will appear here.</p>}</div></section>
}

function ProfilePanel({ user, profile, notify }) {
  const [form, setForm] = useState({ displayName: profile.displayName, username: profile.username, photoURL: profile.photoURL || '', status: profile.status || '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  useEffect(() => setForm({ displayName: profile.displayName, username: profile.username, photoURL: profile.photoURL || '', status: profile.status || '' }), [profile])
  function change(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { await updateProfile(user.uid, profile, form); notify('Profile saved.', 'success') } catch (saveError) { setError(saveError.message || 'Could not save your profile.') } finally { setBusy(false) }
  }
  return <section className="content-panel profile-panel"><div className="panel-heading"><div><p className="eyebrow">MAKE IT YOURS</p><h1>Your profile</h1><p>Choose what your friends see.</p></div><Avatar profile={profile} className="avatar-profile" /></div><form className="profile-form" onSubmit={save}><div className="profile-field-grid"><label>Display name<input name="displayName" value={form.displayName} onChange={change} maxLength={40} required /></label><label>Username<div className="username-input"><span>@</span><input name="username" value={form.username} onChange={change} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required /></div></label></div><label>Short status<input name="status" value={form.status} onChange={change} maxLength={100} placeholder="A little note for your friends" /></label><label>Profile picture URL<input name="photoURL" type="url" value={form.photoURL} onChange={change} maxLength={500} placeholder="https://…" /></label><div className="email-field"><span>Account email</span><strong>{user.email}</strong><small>Your email is private and isn’t shown on your profile.</small></div>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="primary-button save-profile" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}<Check size={16} /></button></form></section>
}

function ChatView({ user, friend, conversationId, onBack, notify }) {
  const [latest, setLatest] = useState([]); const [older, setOlder] = useState([]); const [text, setText] = useState(''); const [loadingOlder, setLoadingOlder] = useState(false); const [hasMore, setHasMore] = useState(true); const [sending, setSending] = useState(false); const [messageError, setMessageError] = useState('')
  const bottomRef = useRef(null); const scrollRef = useRef(null); const inputRef = useRef(null)
  const messages = useMemo(() => [...new Map([...older, ...latest].map((message) => [message.id, message])).values()].sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)), [older, latest])
  useEffect(() => {
    setLatest([]); setOlder([]); setHasMore(true); setMessageError('')
    return subscribeMessages(conversationId, (items) => { setLatest(items); if (items.length < 40) setHasMore(false) }, (error) => setMessageError(error.message || 'Could not load messages.'))
  }, [conversationId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [latest.length, conversationId])
  async function loadPrevious() {
    if (loadingOlder || !hasMore || !latest.length) return
    const container = scrollRef.current; const oldHeight = container?.scrollHeight || 0; setLoadingOlder(true)
    try {
      const items = await loadOlderMessages(conversationId, older[0] || latest[0]); setOlder((current) => [...items, ...current]); setHasMore(items.length === 40)
      requestAnimationFrame(() => { if (container) container.scrollTop += container.scrollHeight - oldHeight })
    } catch (error) { notify(error.message || 'Could not load previous messages.') } finally { setLoadingOlder(false) }
  }
  async function submit(event) {
    event.preventDefault(); const value = text.trim(); if (!value || sending) return
    setSending(true); setMessageError('')
    try { await sendMessage(conversationId, user.uid, value); setText(''); inputRef.current?.focus() } catch (error) { setMessageError(error.message || 'Message could not be sent. Check your connection and try again.') } finally { setSending(false) }
  }
  return <section className="chat-view" aria-label={`Conversation with ${friend?.displayName || 'friend'}`}><header className="chat-header"><button type="button" className="icon-button mobile-back" onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={19} /></button><Avatar profile={friend} className="avatar-large" /><div className="chat-header-person"><strong>{friend?.displayName || 'Friend'}</strong><span>@{friend?.username || 'member'}</span></div>{friend?.status && <span className="chat-header-status">{friend.status}</span>}<button type="button" className="icon-button chat-more" aria-label="Conversation details" title="Conversation details"><MoreHorizontal size={20} /></button></header>
        <div className="message-scroll" ref={scrollRef}>{hasMore && latest.length > 0 && <button className="load-older" type="button" onClick={loadPrevious} disabled={loadingOlder}>{loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}{messages.length === 0 && !messageError ? <div className="conversation-start"><span className="start-icon"><MessageCircle size={19} /></span><strong>This is the start of your conversation.</strong><span>Say hello to {friend?.displayName || 'your friend'}.</span></div> : <div className="message-list">{messages.map((message, index) => {
      const sent = message.senderUid === user.uid; const previous = messages[index - 1]
      const showTime = !previous || !previous.createdAt?.toDate || !message.createdAt?.toDate || message.createdAt.toDate() - previous.createdAt.toDate() > 5 * 60 * 1000
      return <div key={message.id} className={`message-row ${sent ? 'sent' : 'received'} ${showTime ? 'with-time' : ''}`}>{showTime && <time className="message-time">{timeLabel(message.createdAt)}</time>}<p className="message-bubble">{message.text}</p></div>
    })}</div>}{messageError && <p className="inline-error" role="alert">{messageError}</p>}<div ref={bottomRef} /></div>
    <div className="composer-wrap"><form className="composer" onSubmit={submit}><label className="sr-only" htmlFor="message-composer">Message</label><input ref={inputRef} id="message-composer" value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder={`Message ${friend?.displayName || 'your friend'}…`} autoComplete="off" /><span className="composer-count">{text.length > 3500 ? `${text.length}/4000` : ''}</span><button type="submit" className="send-button" disabled={!text.trim() || sending} aria-label="Send message" title="Send message"><Send size={18} /></button></form>{messageError && <p className="composer-error" role="alert">{messageError}</p>}</div>
  </section>
}

function App() {
  const [user, setUser] = useState(null); const [authReady, setAuthReady] = useState(false); const [profile, setProfile] = useState(null); const [profileReady, setProfileReady] = useState(false)
  const [activeTab, setActiveTab] = useState('chats'); const [conversations, setConversations] = useState([]); const [friends, setFriends] = useState([]); const [requests, setRequests] = useState({ incoming: [], outgoing: [] }); const [activeId, setActiveId] = useState(''); const [activeFriend, setActiveFriend] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('palschat-theme') || 'light'); const [toast, setToast] = useState(null); const toastTimer = useRef(null)
  useEffect(() => {
    if (!firebaseConfigured) return undefined
    return onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthReady(true); setProfile(null); setProfileReady(!nextUser) }, () => setAuthReady(true))
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('palschat-theme', theme) }, [theme])
  useEffect(() => {
    if (!user) return undefined
    setProfileReady(false)
    return subscribeProfile(user.uid, (nextProfile) => { setProfile(nextProfile); setProfileReady(true) }, (error) => { setProfileReady(true); notify(error.message || 'Could not load your profile.') })
  }, [user])
  useEffect(() => {
    if (!user || !profile) return undefined
    const fail = (error) => notify(error.message || 'Could not load this information.')
    const unsubscribers = [subscribeConversations(user.uid, setConversations, fail), subscribeFriendRequests(user.uid, setRequests, fail), subscribeFriends(user.uid, setFriends, fail)]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [user, profile?.uid])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  function notify(message, kind = 'error') { setToast({ message, kind }); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 3800) }
  async function openConversation(friend, existingId) {
    try { const id = existingId || await getOrCreateConversation(user.uid, friend.uid); setActiveFriend(friend); setActiveId(id); setActiveTab('chats') } catch (error) { notify(error.message || 'Could not open this conversation.') }
  }
  async function logout() { try { await signOut(auth); setActiveId('') } catch (error) { notify(authMessage(error)) } }
  if (!firebaseConfigured) return <ConfigScreen />
  if (!authReady || (user && !profileReady)) return <LoadingScreen />
  if (!user) return <AuthScreen />
  if (!profile) return <ProfileSetup user={user} />
  const activeConversation = conversations.find((conversation) => conversation.id === activeId); const chatFriend = activeConversation?.friend || activeFriend; const showChat = activeTab === 'chats' && Boolean(activeId && chatFriend)
  const title = { chats: 'Your messages', people: 'Find your people', requests: 'Friend requests', profile: 'Your profile' }[activeTab]
  return <main className={`app-shell ${showChat ? 'mobile-chat-open' : ''}`}><Sidebar profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} conversations={conversations} friends={friends} activeId={activeId} openConversation={openConversation} requestCount={requests.incoming.length} theme={theme} toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} onSignOut={logout} /><div className="main-content"><header className="mobile-topbar"><div className="brand-mark">p</div><strong>{title}</strong><button className="icon-button" type="button" onClick={() => setActiveTab('profile')} aria-label="Open profile"><Avatar profile={profile} /></button></header>{activeTab === 'chats' ? showChat ? <ChatView user={user} friend={chatFriend} conversationId={activeId} onBack={() => setActiveId('')} notify={notify} /> : <EmptyChat onFindPeople={() => setActiveTab('people')} /> : activeTab === 'people' ? <PeoplePanel user={user} friends={friends} requests={requests} onOpenConversation={openConversation} notify={notify} /> : activeTab === 'requests' ? <RequestsPanel requests={requests} notify={notify} /> : <ProfilePanel user={user} profile={profile} notify={notify} />}</div>{toast && <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.kind === 'success' ? <Check size={17} /> : <CircleHelp size={17} />}<span>{toast.message}</span><button type="button" className="icon-button toast-close" onClick={() => setToast(null)} aria-label="Dismiss message"><X size={15} /></button></div>}</main>
}

export default App