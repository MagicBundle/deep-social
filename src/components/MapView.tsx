import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { MapFocus, MapLayer, NearbyProfile, SocialEvent, World } from '../types'
import { CITY_CENTER, DEFAULT_VIEW, INTEREST_BY_ID, interestFor } from '../data/mock'
import { isLive } from '../sim/engine'

interface Props {
  world: World
  people: NearbyProfile[]
  filters: Set<string>
  layer: MapLayer
  selectedEventId: string | null
  onSelectEvent: (id: string) => void
  onSelectPerson: (id: string) => void
  focus: MapFocus | null
  pinMode: boolean
  draftPin: { lat: number; lng: number } | null
  onPickLocation: (lat: number, lng: number) => void
  mePosition: { lat: number; lng: number }
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function eventIconHtml(event: SocialEvent, live: boolean, selected: boolean): string {
  const interest = interestFor(event.category)
  const classes = ['e-pin', live && 'live', selected && 'selected', event.isPin && 'pinned']
    .filter(Boolean)
    .join(' ')
  const vibeBadge = (event.mediaCount ?? 0) > 0 ? '<span class="vibe-badge">📸</span>' : ''
  return `
    <div class="${classes}" style="--c:${interest.color}">
      <div class="e-ring"></div>
      <div class="e-core">${interest.emoji}</div>
      ${vibeBadge}
    </div>`
}

function memberIconHtml(avatar: string, color: string): string {
  return `<div class="m-dot" style="--c:${color}"><span>${avatar}</span></div>`
}

// Real members from nearby_profiles. Observers render as anonymous dashed
// dots; identified people (beacons/friends) show their avatar.
function personIconHtml(p: NearbyProfile): string {
  if (!p.identified) {
    return '<div class="rp-dot observer"><span>🔭</span></div>'
  }
  const cls = p.isFriend ? 'rp-dot friend' : 'rp-dot'
  const inner = p.avatarEmoji
    ? `<span>${p.avatarEmoji}</span>`
    : p.avatarUrl
      ? `<img src="${p.avatarUrl}" referrerpolicy="no-referrer" alt="" />`
      : '<span>👤</span>'
  return `<div class="${cls}">${inner}</div>`
}

function personTooltip(p: NearbyProfile): string {
  if (p.identified) return `${p.displayName ?? 'Member'}${p.isFriend ? ' · friend' : ''}`
  const labels = p.interests
    .slice(0, 2)
    .map((i) => INTEREST_BY_ID[i]?.label ?? i)
    .join(', ')
  return labels ? `Someone into ${labels}` : 'Someone nearby'
}

export default function MapView({
  world,
  people,
  filters,
  layer,
  selectedEventId,
  onSelectEvent,
  onSelectPerson,
  focus,
  pinMode,
  draftPin,
  onPickLocation,
  mePosition,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const memberMarkers = useRef(new Map<string, L.Marker>())
  const eventMarkers = useRef(new Map<string, L.Marker>())
  const draftMarker = useRef<L.Marker | null>(null)
  const meMarker = useRef<L.Marker | null>(null)
  const personMarkers = useRef(new Map<string, L.Marker>())
  const onSelectRef = useRef(onSelectEvent)
  onSelectRef.current = onSelectEvent
  const onSelectPersonRef = useRef(onSelectPerson)
  onSelectPersonRef.current = onSelectPerson
  const pinModeRef = useRef(pinMode)
  pinModeRef.current = pinMode
  const onPickRef = useRef(onPickLocation)
  onPickRef.current = onPickLocation

  // Init map once
  useEffect(() => {
    const map = L.map(containerRef.current!, {
      zoomControl: false,
      attributionControl: true,
    }).setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom)

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19 }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // Smooth member-marker motion is CSS-driven; disable it while zooming so
    // markers don't visibly slide to their re-projected positions.
    const el = containerRef.current!
    map.on('zoomstart', () => el.classList.add('zooming'))
    map.on('zoomend', () => el.classList.remove('zooming'))

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pinModeRef.current) onPickRef.current(e.latlng.lat, e.latlng.lng)
    })

    // "You" marker: starts at the demo home, follows geolocation when granted
    meMarker.current = L.marker([CITY_CENTER.lat, CITY_CENTER.lng], {
      icon: L.divIcon({
        className: 'marker-wrap',
        html: '<div class="me-dot"><div class="me-pulse"></div></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 2000,
      interactive: false,
    }).addTo(map)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      memberMarkers.current.clear()
      eventMarkers.current.clear()
      personMarkers.current.clear()
    }
  }, [])

  // Event markers: create once, refresh icon when live/selected state
  // changes, remove markers for events that disappeared (expired pins).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    for (const e of world.events) {
      seen.add(e.id)
      const live = isLive(e)
      const selected = e.id === selectedEventId
      let marker = eventMarkers.current.get(e.id)
      if (!marker) {
        marker = L.marker([e.lat, e.lng], {
          icon: L.divIcon({
            className: 'marker-wrap',
            html: eventIconHtml(e, live, selected),
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
          zIndexOffset: 1000,
        })
        marker.on('click', () => onSelectRef.current(e.id))
        marker.bindTooltip(`${e.title} · ${e.attendees.length} going`, {
          direction: 'top',
          offset: [0, -18],
        })
        marker.addTo(map)
        eventMarkers.current.set(e.id, marker)
      } else {
        marker.setTooltipContent(`${e.title} · ${e.attendeeCount ?? e.attendees.length} going`)
        const el = marker.getElement()
        if (el) {
          const pin = el.querySelector('.e-pin')
          pin?.classList.toggle('selected', selected)
          pin?.classList.toggle('live', live)
          // Camera badge appearing/disappearing needs an icon rebuild
          const hasBadge = Boolean(el.querySelector('.vibe-badge'))
          const wantsBadge = (e.mediaCount ?? 0) > 0
          if (hasBadge !== wantsBadge) {
            marker.setIcon(
              L.divIcon({
                className: 'marker-wrap',
                html: eventIconHtml(e, live, selected),
                iconSize: [44, 44],
                iconAnchor: [22, 22],
              }),
            )
          }
        }
      }
      const el = marker.getElement()
      const dimmed = filters.size > 0 && !filters.has(e.category)
      el?.classList.toggle('dim', dimmed)
      el?.classList.toggle('layer-hidden', layer === 'friends')
    }
    for (const [id, marker] of eventMarkers.current) {
      if (!seen.has(id)) {
        marker.remove()
        eventMarkers.current.delete(id)
      }
    }
  }, [world.events, selectedEventId, filters, layer])

  // Real members (nearby_profiles): create/update/remove, like event markers.
  // Icon rebuilds when identity/mode changes (e.g. friend accepted, mode flip).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    for (const p of people) {
      seen.add(p.id)
      const html = personIconHtml(p)
      let marker = personMarkers.current.get(p.id)
      if (!marker) {
        marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: 'marker-wrap',
            html,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
          zIndexOffset: 800,
        })
        marker.on('click', () => onSelectPersonRef.current(p.id))
        marker.bindTooltip(personTooltip(p), { direction: 'top', offset: [0, -14] })
        marker.addTo(map)
        personMarkers.current.set(p.id, marker)
      } else {
        marker.setLatLng([p.lat, p.lng])
        marker.setTooltipContent(personTooltip(p))
        const el = marker.getElement()
        if (el && el.querySelector('.rp-dot')?.outerHTML !== html.trim()) {
          marker.setIcon(
            L.divIcon({
              className: 'marker-wrap',
              html,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            }),
          )
        }
      }
      const hidden = layer === 'events' || (layer === 'friends' && !p.isFriend)
      marker.getElement()?.classList.toggle('layer-hidden', hidden)
    }
    for (const [id, marker] of personMarkers.current) {
      if (!seen.has(id)) {
        marker.remove()
        personMarkers.current.delete(id)
      }
    }
  }, [people, layer])

  // Pin-drop mode: crosshair cursor + draft marker at the picked spot
  useEffect(() => {
    containerRef.current?.classList.toggle('pin-mode', pinMode)
  }, [pinMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    draftMarker.current?.remove()
    draftMarker.current = null
    if (draftPin) {
      draftMarker.current = L.marker([draftPin.lat, draftPin.lng], {
        icon: L.divIcon({
          className: 'marker-wrap',
          html: '<div class="draft-pin">📍</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 32],
        }),
        zIndexOffset: 3000,
        interactive: false,
      }).addTo(map)
    }
  }, [draftPin])

  // Member markers: create once, then glide to new positions each tick
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const m of world.members) {
      let marker = memberMarkers.current.get(m.id)
      if (!marker) {
        const color = INTEREST_BY_ID[m.interests[0]].color
        marker = L.marker([m.lat, m.lng], {
          icon: L.divIcon({
            className: 'marker-wrap member-marker',
            html: memberIconHtml(m.avatar, color),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        })
        marker.bindTooltip('', { direction: 'top', offset: [0, -12] })
        marker.addTo(map)
        memberMarkers.current.set(m.id, marker)
      } else {
        marker.setLatLng([m.lat, m.lng])
      }
      marker.setTooltipContent(`${m.avatar} ${m.name} — ${m.activity}`)
      const el = marker.getElement()
      const dimmed = filters.size > 0 && !m.interests.some((i) => filters.has(i))
      el?.classList.toggle('dim', dimmed)
      // Sim members are ambience: only show them on the full map
      el?.classList.toggle('layer-hidden', layer !== 'both')
    }
  }, [world.members, filters, layer])

  useEffect(() => {
    meMarker.current?.setLatLng([mePosition.lat, mePosition.lng])
  }, [mePosition])

  // Fly to search results / selected events
  useEffect(() => {
    if (!focus || !mapRef.current) return
    mapRef.current.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.9 })
  }, [focus])

  return <div ref={containerRef} className="map-root" />
}
