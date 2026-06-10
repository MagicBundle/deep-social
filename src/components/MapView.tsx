import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { MapFocus, World } from '../types'
import { CITY_CENTER, INTEREST_BY_ID } from '../data/mock'
import { isLive } from '../sim/engine'

interface Props {
  world: World
  filters: Set<string>
  selectedEventId: string | null
  onSelectEvent: (id: string) => void
  focus: MapFocus | null
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function eventIconHtml(category: string, live: boolean, selected: boolean): string {
  const interest = INTEREST_BY_ID[category]
  return `
    <div class="e-pin${live ? ' live' : ''}${selected ? ' selected' : ''}" style="--c:${interest.color}">
      <div class="e-ring"></div>
      <div class="e-core">${interest.emoji}</div>
    </div>`
}

function memberIconHtml(avatar: string, color: string): string {
  return `<div class="m-dot" style="--c:${color}"><span>${avatar}</span></div>`
}

export default function MapView({ world, filters, selectedEventId, onSelectEvent, focus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const memberMarkers = useRef(new Map<string, L.Marker>())
  const eventMarkers = useRef(new Map<string, L.Marker>())
  const onSelectRef = useRef(onSelectEvent)
  onSelectRef.current = onSelectEvent

  // Init map once
  useEffect(() => {
    const map = L.map(containerRef.current!, {
      zoomControl: false,
      attributionControl: true,
    }).setView([CITY_CENTER.lat, CITY_CENTER.lng], 13)

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19 }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // Smooth member-marker motion is CSS-driven; disable it while zooming so
    // markers don't visibly slide to their re-projected positions.
    const el = containerRef.current!
    map.on('zoomstart', () => el.classList.add('zooming'))
    map.on('zoomend', () => el.classList.remove('zooming'))

    // "You" marker at the demo home position
    L.marker([CITY_CENTER.lat, CITY_CENTER.lng], {
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
    }
  }, [])

  // Event markers: create once, refresh icon when live/selected state changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const e of world.events) {
      const live = isLive(e)
      const selected = e.id === selectedEventId
      let marker = eventMarkers.current.get(e.id)
      if (!marker) {
        marker = L.marker([e.lat, e.lng], {
          icon: L.divIcon({
            className: 'marker-wrap',
            html: eventIconHtml(e.category, live, selected),
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
        marker.setTooltipContent(`${e.title} · ${e.attendees.length} going`)
        const el = marker.getElement()
        if (el) {
          const pin = el.querySelector('.e-pin')
          pin?.classList.toggle('selected', selected)
          pin?.classList.toggle('live', live)
        }
      }
      const el = marker.getElement()
      const dimmed = filters.size > 0 && !filters.has(e.category)
      el?.classList.toggle('dim', dimmed)
    }
  }, [world.events, selectedEventId, filters])

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
    }
  }, [world.members, filters])

  // Fly to search results / selected events
  useEffect(() => {
    if (!focus || !mapRef.current) return
    mapRef.current.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.9 })
  }, [focus])

  return <div ref={containerRef} className="map-root" />
}
