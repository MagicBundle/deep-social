import { useEffect, useRef, useState } from 'react'
import type {
  ChatMessage,
  FriendEntry,
  MapFocus,
  Pin,
  ProfileHit,
  Provider,
  Session,
  SocialEvent,
} from './types'
import {
  initNativeAuth,
  isBackendConfigured,
  loadSession,
  onBackendAuthChange,
  restoreBackendSession,
  saveSession,
  signOutEverywhere,
} from './auth'
import { CHAT_REPLIES, CHAT_SEEDS, CITY_CENTER, interestFor } from './data/mock'
import {
  addVibe,
  blockUser,
  createEventPin,
  deleteMyAccount,
  dmUnreadCounts,
  endGuardian,
  getConnectTarget,
  myGuardianSessions,
  sendDm,
  startGuardian,
  subscribeToGuardianSessions,
  getMyAvatarEmoji,
  getMyProfile,
  getNearbyPins,
  getNearbyProfiles,
  joinMeetup,
  myFriendships,
  publishHeartbeat,
  removeFriend,
  requestFriend,
  respondFriend,
  setMyAvatarEmoji,
  setMyVibe,
  setVisibilityMode,
  snapForObserver,
  subscribeToDirectMessages,
  subscribeToFriendships,
  subscribeToPosts,
  updateLocation,
} from './services/db'
import { attendingCount, isLive, remotePinId, timeLabel, useSimulation } from './sim/engine'
import LoginScreen from './components/LoginScreen'
import TopBar, { type SearchResult } from './components/TopBar'
import SidePanel, { type PanelTab } from './components/SidePanel'
import MapView from './components/MapView'
import EventCard from './components/EventCard'
import ChatDrawer from './components/ChatDrawer'
import PinComposer, { type PinFormValues } from './components/PinComposer'
import VibeComposer from './components/VibeComposer'
import InterestChips from './components/InterestChips'
import FriendChatDrawer from './components/FriendChatDrawer'
import SharePresenceModal from './components/SharePresenceModal'
import DeepCard, { type ConnectOutcome } from './components/DeepCard'
import PersonCard from './components/PersonCard'
import FriendProfileModal from './components/FriendProfileModal'
import BlockedUsersModal from './components/BlockedUsersModal'
import DeleteAccountModal from './components/DeleteAccountModal'
import ConstellationModal from './components/ConstellationModal'
import GuardianModal from './components/GuardianModal'
import GuardianBar from './components/GuardianBar'
import { neutralMapsLink, openDirections } from './services/navigation'
import { registerPush, unregisterPush, type PushTap } from './services/push'
import type { GuardianSession } from './types'
import type { ConnectTarget, MapLayer, NearbyProfile, VisibilityMode } from './types'

interface Toast {
  id: number
  text: string
}

const PROVIDER_NAME: Record<Provider, string> = {
  apple: 'Apple',
  google: 'Google',
  facebook: 'Meta',
  guest: 'guest mode',
}

let uid = 0
const nextId = () => ++uid

function pinToEvent(p: Pin): SocialEvent {
  return {
    id: `pin-${p.id}`,
    title: p.title,
    venue: p.venue ?? (p.authorName ? `Pinned by ${p.authorName}` : 'Community pin'),
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    startsInMin: Math.round((new Date(p.startsAt).getTime() - Date.now()) / 60_000),
    durationMin: p.durationMin,
    description: p.description ?? '',
    attendees: [],
    isPin: true,
    authorName: p.authorName,
    attendeeCount: p.attendeeCount,
    mediaCount: p.mediaCount,
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const world = useSimulation(session !== null)

  const [filters, setFilters] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<PanelTab>('events')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [chatEventId, setChatEventId] = useState<string | null>(null)
  const [joined, setJoined] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  // User-created event pins: synced from the backend for real sessions,
  // local-only in demo mode. Merged with sim events for every consumer.
  const [userPins, setUserPins] = useState<SocialEvent[]>([])
  const [pinMode, setPinMode] = useState(false)
  const [pinDraft, setPinDraft] = useState<{ lat: number; lng: number } | null>(null)
  const [vibeFor, setVibeFor] = useState<string | null>(null)
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [dmUnread, setDmUnread] = useState<Record<string, number>>({})
  const [dmFriend, setDmFriend] = useState<FriendEntry | null>(null)
  const [mePos, setMePos] = useState(CITY_CENTER)
  const didLocate = useRef(false)
  const [sheetSignal, setSheetSignal] = useState(0)
  const [visibility, setVisibility] = useState<VisibilityMode>('ghost')
  const [myVibe, setMyVibe_] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [nearbyPeople, setNearbyPeople] = useState<NearbyProfile[]>([])
  const [personId, setPersonId] = useState<string | null>(null)
  const [mapLayer, setMapLayer] = useState<MapLayer>('both')
  const [profileFriend, setProfileFriend] = useState<FriendEntry | null>(null)
  const [blockedOpen, setBlockedOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [constellationOpen, setConstellationOpen] = useState(false)
  const [guardianOpen, setGuardianOpen] = useState(false)
  const [guardianSessions, setGuardianSessions] = useState<GuardianSession[]>([])
  const [dismissedGuardianIds, setDismissedGuardianIds] = useState<Set<string>>(new Set())
  /** position confirmed by device geolocation (never the demo default) */
  const [locatedPos, setLocatedPos] = useState<{ lat: number; lng: number } | null>(null)
  const [deepCard, setDeepCard] = useState<{
    target: ConnectTarget
    outcome: ConnectOutcome
    errorText?: string
  } | null>(null)
  const connectHandled = useRef(false)

  const displayWorld = {
    members: world.members,
    events: [...userPins, ...world.events],
  }
  const worldRef = useRef(displayWorld)
  worldRef.current = displayWorld
  const friendsRef = useRef<FriendEntry[]>([])
  friendsRef.current = friends
  const backendLive = isBackendConfigured() && Boolean(session?.real)

  const toast = (text: string) => {
    const id = nextId()
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }

  const flyTo = (lat: number, lng: number, zoom = 15) =>
    setFocus({ lat, lng, zoom, nonce: nextId() })

  const handleLogin = (newSession: Session) => {
    setSession(newSession)
    saveSession(newSession)
    toast(
      newSession.provider === 'guest'
        ? 'Exploring as guest — join an event to get started'
        : newSession.real
          ? `Signed in with ${PROVIDER_NAME[newSession.provider]} as ${newSession.name} ✓`
          : `Signed in with ${PROVIDER_NAME[newSession.provider]} ✓ (demo mode)`,
    )
  }

  const handleSignOut = () => {
    void unregisterPush()
    void signOutEverywhere()
    setSession(null)
  }

  // Native push: register once we have a real session; route notification
  // taps into the app. No-ops on web / simulator. Send side is an Edge
  // Function added once the APNs key exists.
  useEffect(() => {
    if (!backendLive) return
    const onTap = (data: PushTap) => {
      if (data.type === 'dm' && data.friendId) {
        const f = friendsRef.current.find((x) => x.userId === data.friendId)
        if (f) setDmFriend(f)
      } else if (data.type === 'friend') {
        setTab('friends')
        setSheetSignal((n) => n + 1)
      } else if (data.type === 'guardian') {
        refreshGuardians()
      }
    }
    void registerPush(onTap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendLive])

  // Backend session bootstrap: after the Supabase OAuth redirect (or on any
  // later visit while the Supabase session is valid), adopt it as the app
  // session. onBackendAuthChange also clears state on remote sign-out.
  useEffect(() => {
    if (!isBackendConfigured()) return
    initNativeAuth() // no-op on the web; completes OAuth in the iOS shell
    // After adopting a backend session, pull the user's saved emoji avatar.
    const adopt = (s: Session | null) => {
      setSession(s)
      if (!s) return
      getMyAvatarEmoji()
        .then((emoji) => {
          if (emoji) setSession((cur) => (cur ? { ...cur, avatarEmoji: emoji, avatar: emoji } : cur))
        })
        .catch(() => {})
    }
    restoreBackendSession()
      .then((s) => {
        if (s) adopt(s)
      })
      .catch((e) => console.warn('[auth] session restore failed:', e))
    return onBackendAuthChange(adopt)
  }, [])

  const handlePickAvatar = (emoji: string | null) => {
    setSession((cur) =>
      cur ? { ...cur, avatarEmoji: emoji ?? undefined, avatar: emoji ?? cur.avatar } : cur,
    )
    if (session) {
      saveSession({ ...session, avatarEmoji: emoji ?? undefined, avatar: emoji ?? session.avatar })
    }
    toast(emoji ? `Avatar updated ${emoji}` : 'Back to your profile photo')
    if (backendLive) {
      setMyAvatarEmoji(emoji).catch((e) => {
        console.warn('[avatar] save failed:', e)
        toast('Could not save the avatar — is migration 0006 applied?')
      })
    }
  }

  // Shared pins: initial load around the demo city + realtime invalidation.
  // Requires a real session — the RPCs are authenticated-only by design.
  useEffect(() => {
    if (!backendLive) return
    let cancelled = false
    const refresh = () => {
      // 60 km radius around wherever the visitor actually is (Luxembourg
      // City until geolocation resolves)
      getNearbyPins(mePos.lat, mePos.lng, 60_000)
        .then((pins) => {
          if (cancelled) return
          setUserPins((prev) => {
            const remote = pins.map(pinToEvent)
            const remoteIds = new Set(remote.map((e) => e.id))
            const localOnly = prev.filter(
              (p) => p.id.startsWith('local-') && !remoteIds.has(p.id),
            )
            return [...remote, ...localOnly]
          })
          // Server truth for "which pins I attend" (e.g. joined on another device)
          setJoined((prev) => {
            const next = new Set(prev)
            for (const p of pins) if (p.joined) next.add(`pin-${p.id}`)
            return next
          })
        })
        .catch((e) => console.warn('[pins] fetch failed:', e))
    }
    refresh()
    const unsubscribe = subscribeToPosts(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendLive, mePos])

  // Center the experience on the visitor (with their permission). Falls
  // back silently to the Luxembourg default when denied or unavailable.
  useEffect(() => {
    if (!session || !('geolocation' in navigator)) return
    // One-shot: center the map on first fix per app load
    if (!didLocate.current) {
      didLocate.current = true
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setMePos(here)
          setLocatedPos(here)
          flyTo(here.lat, here.lng, 13)
          toast('Centered on your location 📍')
        },
        () => {},
        { timeout: 8000, maximumAge: 300_000 },
      )
    }
    // Keep following while the app is open, but only accept significant
    // movement (>100 m) so state churn and heartbeats stay calm.
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocatedPos((prev) => {
          if (!prev) return here
          const dLat = (here.lat - prev.lat) * 111_320
          const dLng = (here.lng - prev.lng) * 111_320 * Math.cos((here.lat * Math.PI) / 180)
          if (Math.hypot(dLat, dLng) < 100) return prev
          setMePos(here)
          return here
        })
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [session])

  // Publish my position to the backend — but only with a real device fix
  // (never the demo default) and never while in ghost mode. The server-side
  // visibility rules decide who gets to see it and at what precision.
  useEffect(() => {
    if (!backendLive || !locatedPos || visibility === 'ghost') return
    updateLocation(locatedPos.lat, locatedPos.lng).catch((e) =>
      console.warn('[presence] publish failed:', e),
    )
  }, [backendLive, locatedPos, visibility])

  // Hot Layer heartbeats: adaptive cadence — every ~25 s while the app is
  // open, plus immediately on significant movement or vibe change (both
  // re-run this effect). Ghosts publish nothing; observers are grid-snapped
  // client-side to match the server's fuzzing, so the broadcast stream never
  // carries more precision than nearby_profiles would reveal.
  useEffect(() => {
    if (!backendLive || !locatedPos || visibility === 'ghost' || !session?.id) return
    const beat = () => {
      const observer = visibility === 'observer'
      publishHeartbeat({
        userId: session.id!,
        lat: observer ? snapForObserver(locatedPos.lat) : locatedPos.lat,
        lng: observer ? snapForObserver(locatedPos.lng) : locatedPos.lng,
        vibe: myVibe,
        visibility,
      })
    }
    beat()
    const t = setInterval(beat, 25_000)
    return () => clearInterval(t)
  }, [backendLive, locatedPos, visibility, myVibe, session?.id])

  // Real members nearby: fetch + poll (the sim keeps the map lively; real
  // people render on top with distinct styling).
  useEffect(() => {
    if (!backendLive) return
    let cancelled = false
    const refresh = () => {
      getNearbyProfiles(mePos.lat, mePos.lng, 60_000)
        .then((p) => {
          if (!cancelled) setNearbyPeople(p)
        })
        .catch((e) => console.warn('[presence] fetch failed:', e))
    }
    refresh()
    const t = setInterval(refresh, 60_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [backendLive, mePos, visibility])

  // Friends: load + live refresh (RLS scopes events to the caller's rows)
  const refreshFriends = () => {
    myFriendships()
      .then(setFriends)
      .catch((e) => console.warn('[friends] fetch failed:', e))
  }
  useEffect(() => {
    if (!backendLive) return
    refreshFriends()
    return subscribeToFriendships(refreshFriends)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendLive])

  // Unread DM counts: load + live refresh so friend rows and the toast badge
  // stay current even while the chat is closed.
  const refreshUnread = () => {
    dmUnreadCounts()
      .then(setDmUnread)
      .catch((e) => console.warn('[dm] unread fetch failed:', e))
  }
  useEffect(() => {
    if (!backendLive) return
    refreshUnread()
    return subscribeToDirectMessages(refreshUnread)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendLive])

  const openFriendChat = (friend: FriendEntry) => {
    setDmFriend(friend)
    // optimistic: clear this friend's unread badge; markDmRead runs in drawer
    setDmUnread((prev) => {
      const next = { ...prev }
      delete next[friend.userId]
      return next
    })
  }

  // My visibility mode + current vibe (for the profile menu).
  useEffect(() => {
    if (!backendLive) return
    getMyProfile()
      .then((p) => {
        if (p) {
          setVisibility(p.visibilityMode)
          setMyVibe_(p.currentVibe ?? null)
        }
      })
      .catch((e) => console.warn('[visibility] load failed:', e))
  }, [backendLive])

  const handleSetVibe = (vibe: string | null) => {
    setMyVibe_(vibe)
    const label = vibe ? interestFor(vibe) : null
    setMyVibe(vibe)
      .then(() =>
        toast(
          label
            ? `Tonight's vibe: ${label.emoji} ${label.label} — fades in 3 h`
            : 'Vibe cleared',
        ),
      )
      .catch(() => toast('Could not save the vibe — is migration 0009 applied?'))
  }

  const handleSetVisibility = (mode: VisibilityMode) => {
    setVisibility(mode)
    setVisibilityMode(mode)
      .then(() =>
        toast(
          mode === 'ghost'
            ? "Ghost mode — you're invisible to strangers"
            : mode === 'observer'
              ? 'Observer — you appear as an anonymous dot nearby'
              : 'Beacon — your full profile is visible nearby',
        ),
      )
      .catch(() => toast('Could not update visibility — is migration 0008 applied?'))
  }

  // In-person handshake: a #/connect/<id> deep link (from a scanned QR).
  // Stash it on first load — it must survive an OAuth redirect for new users —
  // then process once we have a real backend session.
  useEffect(() => {
    const m = window.location.hash.match(/#\/connect\/([0-9a-fA-F-]{36})/)
    if (m) {
      localStorage.setItem('deep-social.pending-connect', m[1])
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    // Shared event links: #/pin/<uuid> (real pins) or #/event/<seed-id>
    const e = window.location.hash.match(/#\/(pin|event)\/([A-Za-z0-9-]{1,40})/)
    if (e) {
      localStorage.setItem('deep-social.pending-link', `${e[1]}:${e[2]}`)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  // Consume a shared-event link once its target can exist: sim events as
  // soon as a session is up; real pins after the first pins fetch.
  useEffect(() => {
    if (!session) return
    const pending = localStorage.getItem('deep-social.pending-link')
    if (!pending) return
    const [kind, id] = pending.split(':')
    const eventId = kind === 'pin' ? `pin-${id}` : id
    const target = displayWorld.events.find((ev) => ev.id === eventId)
    if (target) {
      localStorage.removeItem('deep-social.pending-link')
      selectEvent(eventId)
      toast(`Someone shared this with you: ${target.title} 📍`)
    } else if (kind === 'event') {
      // seed id that doesn't exist — drop it rather than retrying forever
      localStorage.removeItem('deep-social.pending-link')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, userPins])

  useEffect(() => {
    if (!backendLive || connectHandled.current) return
    const pending = localStorage.getItem('deep-social.pending-connect')
    if (!pending) return
    connectHandled.current = true
    localStorage.removeItem('deep-social.pending-connect')
    if (pending === session?.id) {
      toast("That's your own connect code 🙂")
      return
    }
    getConnectTarget(pending)
      .then(async (target) => {
        if (!target) {
          toast('That connection code is no longer valid')
          return
        }
        try {
          const status = await requestFriend(pending)
          setDeepCard({ target, outcome: status === 'accepted' ? 'connected' : 'sent' })
          refreshFriends()
        } catch (e) {
          setDeepCard({ target, outcome: 'error', errorText: (e as Error).message })
        }
      })
      .catch((e) => console.warn('[connect] failed:', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendLive])

  const handleAddFriend = async (profile: ProfileHit) => {
    try {
      const status = await requestFriend(profile.id)
      toast(
        status === 'accepted'
          ? `You and ${profile.displayName} are now friends 🎉`
          : `Friend request sent to ${profile.displayName}`,
      )
      setTab('friends')
      refreshFriends()
    } catch (e) {
      console.warn('[friends] request failed:', e)
      toast('Could not send the request — is migration 0005 applied?')
    }
  }

  const handleRespondFriend = (userId: string, accept: boolean) => {
    respondFriend(userId, accept)
      .then(() => {
        if (accept) toast('Friend request accepted 🎉')
        refreshFriends()
      })
      .catch(() => toast('Could not update the request, try again'))
  }

  const handleRemoveFriend = (userId: string) => {
    removeFriend(userId)
      .then(refreshFriends)
      .catch(() => toast('Could not remove, try again'))
  }

  const handleBlockUser = (userId: string, name?: string) => {
    // Close every surface that could be showing them, hide optimistically,
    // then let server truth reconcile on the next fetches.
    setPersonId(null)
    setProfileFriend(null)
    setDmFriend(null)
    setNearbyPeople((prev) => prev.filter((p) => p.id !== userId))
    blockUser(userId)
      .then(() => {
        toast(`${name ?? 'User'} blocked — they can no longer see or contact you`)
        refreshFriends()
      })
      .catch(() => toast('Could not block — is migration 0010 applied?'))
  }

  const handleDeleteAccount = async () => {
    await deleteMyAccount()
    setDeleteOpen(false)
    await signOutEverywhere()
    setSession(null)
    toast('Your account and data have been deleted')
  }

  // Guardian sessions: load + realtime + a 1-min tick so overdue warnings
  // appear on the guardian's side even without new events.
  const refreshGuardians = () => {
    myGuardianSessions()
      .then(setGuardianSessions)
      .catch((e) => console.warn('[guardian] fetch failed:', e))
  }
  useEffect(() => {
    if (!backendLive) return
    refreshGuardians()
    const unsub = subscribeToGuardianSessions(refreshGuardians)
    const t = setInterval(() => setGuardianSessions((s) => [...s]), 60_000)
    return () => {
      unsub()
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendLive])

  const handleStartGuardian = async (guardian: FriendEntry, minutes: number, note: string) => {
    await startGuardian(guardian.userId, minutes, note || undefined)
    setGuardianOpen(false)
    const until = new Date(Date.now() + minutes * 60_000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
    sendDm(
      guardian.userId,
      `🛡️ I've asked you to watch over me until ${until}. You can see me live on the map.${note ? ` Where I'm headed: ${note}` : ''}`,
    ).catch(() => {})
    refreshGuardians()
    toast(`${guardian.displayName} is watching over you until ${until} 🛡️`)
  }

  const handleGuardianSafe = (s: GuardianSession) => {
    endGuardian(s.id, true)
      .then(() => {
        sendDm(s.otherId, "✅ I'm safe — guardian mode ended. Thanks for watching over me!").catch(
          () => {},
        )
        refreshGuardians()
        toast('Checked in safe ✓')
      })
      .catch(() => toast('Could not check in — try again'))
  }

  const handleGuardianSOS = (s: GuardianSession) => {
    const pos = locatedPos
      ? ` Last position: https://maps.google.com/?q=${locatedPos.lat.toFixed(5)},${locatedPos.lng.toFixed(5)}`
      : ''
    endGuardian(s.id, false)
      .then(() => {
        sendDm(s.otherId, `🚨 ALERT — I need help.${pos}`).catch(() => {})
        refreshGuardians()
        toast(`Alert sent to ${s.otherName} 🚨`)
      })
      .catch(() => toast('Could not send the alert — call them directly'))
  }

  // Directions hand-off to Apple/Google Maps. If a guardian is watching,
  // they get told where you're headed — the destination + a neutral link.
  const handleNavigate = (lat: number, lng: number, label: string) => {
    openDirections(lat, lng)
    toast(`Opening walking directions to ${label} 🧭`)
    const g = guardianSessions.find((s) => s.role === 'protege' && s.status === 'active')
    if (g) {
      sendDm(g.otherId, `🧭 Heading to ${label} — ${neutralMapsLink(lat, lng)}`).catch(() => {})
    }
  }

  const handleGuardianLocate = (s: GuardianSession) => {
    const p = nearbyPeople.find((np) => np.id === s.otherId)
    if (p) selectPerson(p.id)
    else toast(`${s.otherName} isn't sharing a live position right now — check your messages`)
  }

  // Esc exits pin-drop mode / closes the composer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinMode(false)
        setPinDraft(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handlePickLocation = (lat: number, lng: number) => {
    setPinDraft({ lat, lng })
    setPinMode(false)
  }

  const handleCreatePin = async (values: PinFormValues) => {
    if (!pinDraft || !session) return
    const spot = pinDraft
    setPinDraft(null)
    let id = `local-${nextId()}`
    if (backendLive) {
      try {
        const remoteId = await createEventPin({
          title: values.title,
          category: values.category,
          lat: spot.lat,
          lng: spot.lng,
          startsInMin: values.startsInMin,
          durationMin: values.durationMin,
          description: values.description || undefined,
          venue: values.venue || undefined,
        })
        id = `pin-${remoteId}`
        toast('Pinned to the live map 🌍 — everyone nearby can see it')
      } catch (e) {
        console.warn('[pins] backend create failed:', e)
        if (String((e as Error).message).includes('daily pin limit')) {
          toast("You've hit today's 3-pin limit — the pin stays on your map only 🌙")
        } else {
          toast('Could not sync the pin — kept locally')
        }
      }
    } else {
      toast('Pinned! Local only in demo mode — Google sign-in publishes for real')
    }
    const event: SocialEvent = {
      id,
      title: values.title,
      venue: values.venue ?? `Pinned by ${session.name}`,
      category: values.category,
      lat: spot.lat,
      lng: spot.lng,
      startsInMin: values.startsInMin,
      durationMin: values.durationMin,
      description: values.description,
      attendees: [],
      isPin: true,
      authorName: session.name,
    }
    setUserPins((prev) => [event, ...prev.filter((p) => p.id !== id)])
    setJoined((prev) => new Set(prev).add(id))
    setSelectedEventId(id)
  }

  const selectEvent = (id: string) => {
    setPersonId(null) // one bottom card at a time
    setSelectedEventId(id)
    const e = worldRef.current.events.find((ev) => ev.id === id)
    if (e) flyTo(e.lat, e.lng, 15)
  }

  const selectPerson = (id: string) => {
    const p = nearbyPeople.find((np) => np.id === id)
    if (!p) return
    setSelectedEventId(null)
    setPersonId(id)
    flyTo(p.lat, p.lng, 15)
  }

  const handlePersonConnect = (person: NearbyProfile) => {
    requestFriend(person.id)
      .then((status) => {
        toast(
          status === 'accepted'
            ? `You're connected 🎉`
            : person.identified
              ? `Friend request sent to ${person.displayName}`
              : "Request sent — they'll see your profile and can accept",
        )
        refreshFriends()
      })
      .catch((e) => {
        console.warn('[connect] request failed:', e)
        toast('Could not send the request, try again')
      })
  }

  const handlePersonMessage = (person: NearbyProfile) => {
    const entry = friends.find((f) => f.userId === person.id)
    setPersonId(null)
    openFriendChat(
      entry ?? {
        userId: person.id,
        displayName: person.displayName ?? 'Member',
        avatarUrl: person.avatarUrl,
        avatarEmoji: person.avatarEmoji,
        interests: person.interests,
        state: 'friend',
        since: new Date().toISOString(),
      },
    )
  }

  const toggleFilter = (id: string) => {
    setFilters((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const seedChannel = (eventId: string) => {
    setMessages((prev) => {
      if (prev[eventId]?.length) return prev
      const event = worldRef.current.events.find((e) => e.id === eventId)
      if (!event) return prev
      const seeds = CHAT_SEEDS[event.category] ?? []
      const authors = event.attendees
        .map((id) => worldRef.current.members.find((m) => m.id === id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
      const seeded: ChatMessage[] = seeds.slice(0, 3).map((text, i) => {
        const author = authors[i % Math.max(authors.length, 1)]
        return {
          id: `c${nextId()}`,
          channelId: eventId,
          authorName: author?.name ?? 'Organizer',
          avatar: author?.avatar ?? '📣',
          text,
          ts: Date.now() - (3 - i) * 60_000,
        }
      })
      return { ...prev, [eventId]: seeded }
    })
  }

  const openChat = (eventId: string) => {
    seedChannel(eventId)
    setChatEventId(eventId)
  }

  // Ambient chat: while a channel is open, attendees occasionally post.
  useEffect(() => {
    if (!chatEventId) return
    const id = setInterval(() => {
      if (Math.random() > 0.45) return
      const event = worldRef.current.events.find((e) => e.id === chatEventId)
      if (!event || !event.attendees.length) return
      const authorId = event.attendees[Math.floor(Math.random() * event.attendees.length)]
      const author = worldRef.current.members.find((m) => m.id === authorId)
      if (!author) return
      const pool = [...(CHAT_SEEDS[event.category] ?? []), ...CHAT_REPLIES]
      const text = pool[Math.floor(Math.random() * pool.length)]
      setMessages((prev) => ({
        ...prev,
        [chatEventId]: [
          ...(prev[chatEventId] ?? []),
          {
            id: `c${nextId()}`,
            channelId: chatEventId,
            authorName: author.name,
            avatar: author.avatar,
            text,
            ts: Date.now(),
          },
        ],
      }))
    }, 8000)
    return () => clearInterval(id)
  }, [chatEventId])

  const sendMessage = (text: string) => {
    if (!chatEventId || !session) return
    const channel = chatEventId
    setMessages((prev) => ({
      ...prev,
      [channel]: [
        ...(prev[channel] ?? []),
        {
          id: `c${nextId()}`,
          channelId: channel,
          authorName: session.name,
          avatar: session.avatar,
          text,
          ts: Date.now(),
          mine: true,
        },
      ],
    }))
    // Simulated reply, as if over the realtime channel
    setTimeout(() => {
      const event = worldRef.current.events.find((e) => e.id === channel)
      const authorId = event?.attendees[Math.floor(Math.random() * (event?.attendees.length || 1))]
      const author = worldRef.current.members.find((m) => m.id === authorId)
      setMessages((prev) => ({
        ...prev,
        [channel]: [
          ...(prev[channel] ?? []),
          {
            id: `c${nextId()}`,
            channelId: channel,
            authorName: author?.name ?? 'Organizer',
            avatar: author?.avatar ?? '📣',
            text: CHAT_REPLIES[Math.floor(Math.random() * CHAT_REPLIES.length)],
            ts: Date.now(),
          },
        ],
      }))
    }, 1200 + Math.random() * 2200)
  }

  const handleJoin = (eventId: string) => {
    if (joined.has(eventId)) {
      openChat(eventId)
      return
    }
    setJoined((prev) => new Set(prev).add(eventId))
    const e = worldRef.current.events.find((ev) => ev.id === eventId)
    toast(`You're in! ${e?.title ?? 'Meetup'} added to My meetups 🎉`)
    openChat(eventId)

    // Synced pins: persist attendance server-side (optimistic count bump;
    // the realtime posts UPDATE will reconcile with server truth).
    const rawId = remotePinId(eventId)
    if (rawId && backendLive) {
      setUserPins((prev) =>
        prev.map((p) =>
          p.id === eventId ? { ...p, attendeeCount: (p.attendeeCount ?? 0) + 1 } : p,
        ),
      )
      joinMeetup(rawId).catch((err) => {
        console.warn('[attendance] join failed:', err)
        setJoined((prev) => {
          const next = new Set(prev)
          next.delete(eventId)
          return next
        })
        setUserPins((prev) =>
          prev.map((p) =>
            p.id === eventId ? { ...p, attendeeCount: Math.max((p.attendeeCount ?? 1) - 1, 0) } : p,
          ),
        )
        toast('Could not sync your join — is migration 0004 applied?')
      })
    }
  }

  const handleVibePost = async (event: SocialEvent, image: Blob) => {
    const rawId = remotePinId(event.id)
    if (!rawId) return
    await addVibe(rawId, image)
    setVibeFor(null)
    toast('Vibe posted 📸 — visible to everyone on this pin')
    setUserPins((prev) =>
      prev.map((p) => (p.id === event.id ? { ...p, mediaCount: (p.mediaCount ?? 0) + 1 } : p)),
    )
  }

  const handleSearchPick = (r: SearchResult) => {
    if (r.kind === 'interest') {
      setFilters((prev) => new Set(prev).add(r.id))
      toast('Map filtered — tap the chip again to clear')
    } else if (r.kind === 'event') {
      selectEvent(r.id)
    } else {
      const m = worldRef.current.members.find((mm) => mm.id === r.id)
      if (m) flyTo(m.lat, m.lng, 15)
    }
  }

  if (!session) return <LoginScreen onLogin={handleLogin} />

  const selectedEvent = displayWorld.events.find((e) => e.id === selectedEventId) ?? null
  const chatEvent = displayWorld.events.find((e) => e.id === chatEventId) ?? null
  const vibeEvent = displayWorld.events.find((e) => e.id === vibeFor) ?? null
  const selectedPerson = nearbyPeople.find((p) => p.id === personId) ?? null
  const liveCount = displayWorld.events.filter(isLive).length

  const joinedEvents = displayWorld.events.filter((e) => joined.has(e.id))
  const nextEvent = joinedEvents
    .filter((e) => e.startsInMin > 0)
    .sort((a, b) => a.startsInMin - b.startsInMin)[0]
  const liveJoined = joinedEvents.find((e) => isLive(e))
  const unreadDmTotal = Object.values(dmUnread).reduce((a, b) => a + b, 0)
  const menuStats = {
    friendCount: friends.filter((f) => f.state === 'friend').length,
    requestCount: friends.filter((f) => f.state === 'incoming').length,
    unreadDms: unreadDmTotal,
    meetupCount: joined.size,
    nextEventLabel: liveJoined
      ? `${liveJoined.title} · LIVE`
      : nextEvent
        ? `${nextEvent.title} ${timeLabel(nextEvent)}`
        : null,
  }

  return (
    <div className={`app${chatEvent || dmFriend ? ' chat-open' : ''}`}>
      <MapView
        world={displayWorld}
        people={nearbyPeople}
        filters={filters}
        layer={mapLayer}
        selectedEventId={selectedEventId}
        onSelectEvent={selectEvent}
        onSelectPerson={selectPerson}
        focus={focus}
        pinMode={pinMode}
        draftPin={pinDraft}
        onPickLocation={handlePickLocation}
        mePosition={mePos}
      />

      <TopBar
        session={session}
        world={displayWorld}
        liveCount={liveCount}
        backendLive={backendLive}
        stats={menuStats}
        visibilityMode={visibility}
        myVibe={myVibe}
        onPick={handleSearchPick}
        onAddFriend={handleAddFriend}
        onNavigateTab={(t) => {
          setTab(t)
          setSheetSignal((n) => n + 1)
        }}
        onPickAvatar={handlePickAvatar}
        onSetVisibility={handleSetVisibility}
        onSetVibe={handleSetVibe}
        onSharePresence={() => setShareOpen(true)}
        onOpenConstellation={() => setConstellationOpen(true)}
        onOpenGuardian={() => setGuardianOpen(true)}
        onOpenBlocked={() => setBlockedOpen(true)}
        onDeleteAccount={() => setDeleteOpen(true)}
        onSignOut={handleSignOut}
      />

      <GuardianBar
        sessions={guardianSessions.filter((s) => !dismissedGuardianIds.has(s.id))}
        onSafe={handleGuardianSafe}
        onSOS={handleGuardianSOS}
        onLocate={handleGuardianLocate}
        onDismiss={(id) => setDismissedGuardianIds((prev) => new Set(prev).add(id))}
      />

      {/* Mobile-only: glassy horizontal filter bar over the map (the same
          chips live inside the side panel on desktop) */}
      <div className="chips-bar">
        <InterestChips filters={filters} onToggle={toggleFilter} />
      </div>

      {/* Map layer switch: everything / friends only / events only */}
      <div className="layer-toggle" role="group" aria-label="Map layers">
        <button
          className={mapLayer === 'both' ? 'active' : ''}
          title="Show everything"
          onClick={() => setMapLayer('both')}
        >
          ✨ <span className="lt-label">All</span>
        </button>
        <button
          className={mapLayer === 'friends' ? 'active' : ''}
          title="Friends only"
          onClick={() => setMapLayer('friends')}
        >
          👥 <span className="lt-label">Friends</span>
        </button>
        <button
          className={mapLayer === 'events' ? 'active' : ''}
          title="Events only"
          onClick={() => setMapLayer('events')}
        >
          📍 <span className="lt-label">Events</span>
        </button>
      </div>

      <SidePanel
        world={displayWorld}
        filters={filters}
        onToggleFilter={toggleFilter}
        tab={tab}
        onTab={setTab}
        joined={joined}
        selectedEventId={selectedEventId}
        onSelectEvent={selectEvent}
        friends={friends}
        backendLive={backendLive}
        dmUnread={dmUnread}
        people={nearbyPeople}
        onSelectPerson={selectPerson}
        onRespondFriend={handleRespondFriend}
        onRemoveFriend={handleRemoveFriend}
        onOpenFriendChat={openFriendChat}
        onOpenProfile={setProfileFriend}
        openSignal={sheetSignal}
      />

      <button
        className={`fab-pin${pinMode ? ' cancel' : ''}`}
        onClick={() => {
          setPinMode((m) => !m)
          setPinDraft(null)
        }}
      >
        {pinMode ? '✕ Cancel' : '📍 Pin event'}
      </button>

      {pinMode && !pinDraft && (
        <div className="pin-hint">Click the map where your event happens · Esc to cancel</div>
      )}

      {pinDraft && session && (
        <PinComposer
          location={pinDraft}
          live={backendLive}
          onLocationChange={(lat, lng) => {
            setPinDraft({ lat, lng })
            flyTo(lat, lng, 15)
          }}
          onCreate={handleCreatePin}
          onCancel={() => setPinDraft(null)}
          onRepickOnMap={() => {
            setPinDraft(null)
            setPinMode(true)
          }}
        />
      )}

      {selectedEvent && (
        <EventCard
          event={selectedEvent}
          world={displayWorld}
          joined={joined.has(selectedEvent.id)}
          backendLive={backendLive}
          onJoin={() => handleJoin(selectedEvent.id)}
          onChat={() => openChat(selectedEvent.id)}
          onVibeCheck={() => setVibeFor(selectedEvent.id)}
          onNavigate={handleNavigate}
          onNotify={toast}
          onClose={() => setSelectedEventId(null)}
        />
      )}

      {vibeEvent && (
        <VibeComposer
          eventTitle={vibeEvent.title}
          onPost={(image) => handleVibePost(vibeEvent, image)}
          onClose={() => setVibeFor(null)}
        />
      )}

      {chatEvent && (
        <ChatDrawer
          event={chatEvent}
          messages={messages[chatEvent.id] ?? []}
          attendeeCount={attendingCount(chatEvent, joined.has(chatEvent.id))}
          onSend={sendMessage}
          onClose={() => setChatEventId(null)}
        />
      )}

      {dmFriend && <FriendChatDrawer friend={dmFriend} onClose={() => setDmFriend(null)} />}

      {profileFriend && (
        <FriendProfileModal
          friend={profileFriend}
          nearby={nearbyPeople.find((p) => p.id === profileFriend.userId) ?? null}
          onMessage={() => {
            setProfileFriend(null)
            openFriendChat(profileFriend)
          }}
          onShowOnMap={() => {
            setProfileFriend(null)
            selectPerson(profileFriend.userId)
          }}
          onNavigate={(lat, lng, label) => {
            setProfileFriend(null)
            handleNavigate(lat, lng, label)
          }}
          onAccept={() => {
            setProfileFriend(null)
            handleRespondFriend(profileFriend.userId, true)
          }}
          onDecline={() => {
            setProfileFriend(null)
            handleRespondFriend(profileFriend.userId, false)
          }}
          onRemove={() => {
            setProfileFriend(null)
            handleRemoveFriend(profileFriend.userId)
          }}
          onBlock={() => handleBlockUser(profileFriend.userId, profileFriend.displayName)}
          onClose={() => setProfileFriend(null)}
        />
      )}

      {selectedPerson && (
        <PersonCard
          person={selectedPerson}
          friendState={friends.find((f) => f.userId === selectedPerson.id)?.state ?? null}
          onConnect={() => handlePersonConnect(selectedPerson)}
          onAccept={() => handleRespondFriend(selectedPerson.id, true)}
          onMessage={() => handlePersonMessage(selectedPerson)}
          onNavigate={handleNavigate}
          onBlock={() => handleBlockUser(selectedPerson.id, selectedPerson.displayName)}
          onClose={() => setPersonId(null)}
        />
      )}

      {blockedOpen && <BlockedUsersModal onNotify={toast} onClose={() => setBlockedOpen(false)} />}

      {constellationOpen && (
        <ConstellationModal
          friends={friends}
          onFlyTo={(lat, lng) => {
            setConstellationOpen(false)
            flyTo(lat, lng, 15)
          }}
          onNotify={toast}
          onClose={() => setConstellationOpen(false)}
        />
      )}

      {guardianOpen && (
        <GuardianModal
          friends={friends}
          onStart={handleStartGuardian}
          onClose={() => setGuardianOpen(false)}
        />
      )}

      {deleteOpen && (
        <DeleteAccountModal onConfirm={handleDeleteAccount} onClose={() => setDeleteOpen(false)} />
      )}

      {shareOpen && session?.id && (
        <SharePresenceModal
          userId={session.id}
          name={session.name}
          onClose={() => setShareOpen(false)}
        />
      )}

      {deepCard && (
        <DeepCard
          target={deepCard.target}
          outcome={deepCard.outcome}
          errorText={deepCard.errorText}
          onMessage={
            deepCard.outcome === 'connected'
              ? () => {
                  const t = deepCard.target
                  setDeepCard(null)
                  openFriendChat({
                    userId: t.id,
                    displayName: t.displayName,
                    avatarUrl: t.avatarUrl,
                    avatarEmoji: t.avatarEmoji,
                    interests: t.interests,
                    state: 'friend',
                    since: new Date().toISOString(),
                  })
                }
              : undefined
          }
          onClose={() => setDeepCard(null)}
        />
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

