import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { supabase } from '../lib/supabaseclient'
import { useAuth } from '../context/useAuth'
import { DAMAGE_TYPES } from '../lib/damageTypes'
import { isValidCoordinate } from '../lib/validation'
import { getAppSettings, saveAppSettings } from '../lib/appSettings'
import Navbar from '../components/Navbar'
import './HazardMap.css'



delete L.Icon.Default.prototype._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})



const createIcon = (color, className = '') =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className,
  })

const createClusterIcon = (cluster) =>
  L.divIcon({
    html: `<span>${cluster.getChildCount()}</span>`,
    className: 'hm-marker-cluster',
    iconSize: L.point(42, 42, true),
  })

const damageIcons = {
  lubang: createIcon('red', 'hm-report-marker'),
  retak: createIcon('yellow', 'hm-report-marker'),
  banjir: createIcon('blue', 'hm-report-marker'),
  amblas: createIcon('red', 'hm-report-marker'),
  drainase: createIcon('blue', 'hm-report-marker'),
  marka: createIcon('yellow', 'hm-report-marker'),
}

const damageMeta = DAMAGE_TYPES

const statusColors = {
  Diterima: '#94a3b8',
  Diverifikasi: '#3b82f6',
  Proses: '#f59e0b',
  Selesai: '#22c55e',
}

const DEFAULT_CENTER = [-3.9778, 122.5150]
const FOCUS_ZOOM = 18
const DETAIL_MARKER_MIN_ZOOM = 11




function normalizeCoordinates(report) {
  if (!report) return null

  let lat = Number(report.latitude)
  let lng = Number(report.longitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    ;[lat, lng] = [lng, lat]
  }

  if (lat < -90 || lat > 90) {
    return null
  }

  if (lng < -180 || lng > 180) {
    return null
  }

  
  if (
    Math.abs(lat) < 0.000001 &&
    Math.abs(lng) < 0.000001
  ) {
    return null
  }

  
  try {
    if (!isValidCoordinate(lat, lng)) {
      return null
    }
  } catch {
  }

  return [lat, lng]
}




function FlyToReport({
  targetReport,
  markerRefs,
}) {
  const map = useMap()

  useEffect(() => {
    if (!targetReport) return

    const position =
      normalizeCoordinates(targetReport)

    if (!position) {
      console.warn(
        'Koordinat laporan tidak valid:',
        targetReport.id
      )

      return
    }

    const from = map.getCenter()

    const distance = from.distanceTo(position)

    const duration = Math.min(
      2.5,
      Math.max(1, distance / 4000)
    )

    map.flyTo(
      position,
      FOCUS_ZOOM,
      {
        duration,
        easeLinearity: 0.25,
      }
    )

    const timer = setTimeout(() => {
      const marker =
        markerRefs.current[targetReport.id]

      if (marker) {
        marker.openPopup()
      }
    }, duration * 1000 + 150)

    return () => {
      clearTimeout(timer)
    }
  }, [targetReport, map, markerRefs])

  return null
}



function CenterOnLocation({
  location,
  enabled,
}) {
  const map = useMap()
  const hasCentered = useRef(false)

  useEffect(() => {
    if (
      !enabled ||
      !location ||
      hasCentered.current
    ) {
      return
    }

    map.setView(
      location,
      Math.max(map.getZoom(), 15),
      {
        animate: true,
      }
    )

    hasCentered.current = true
  }, [enabled, location, map])

  return null
}


function SyncMapSize() {
  const map = useMap()

  useEffect(() => {
    const invalidate = () => map.invalidateSize({ animate: false })
    const frame = requestAnimationFrame(invalidate)
    const afterPageAnimation = window.setTimeout(invalidate, 500)
    const settingsHandler = () => requestAnimationFrame(invalidate)
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(invalidate)

    window.addEventListener('resize', invalidate)
    window.addEventListener('sijaka:app-settings', settingsHandler)
    resizeObserver?.observe(map.getContainer().parentElement || map.getContainer())

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(afterPageAnimation)
      window.removeEventListener('resize', invalidate)
      window.removeEventListener('sijaka:app-settings', settingsHandler)
      resizeObserver?.disconnect()
    }
  }, [map])

  return null
}

function SyncMapZoomClass() {
  const map = useMap()

  useEffect(() => {
    const updateZoomClass = () => {
      map.getContainer().classList.toggle(
        'hm-map-zoom-far',
        map.getZoom() < DETAIL_MARKER_MIN_ZOOM
      )
    }

    updateZoomClass()
    map.on('zoomend', updateZoomClass)
    return () => map.off('zoomend', updateZoomClass)
  }, [map])

  return null
}



function LocateMeButton() {
  const map = useMap()
  const [busy, setBusy] = useState(false)

  const locate = () => {
    if (!navigator.geolocation) {
      return
    }

    setBusy(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude =
          position.coords.latitude

        const longitude =
          position.coords.longitude

        if (
          isValidCoordinate(
            latitude,
            longitude
          )
        ) {
          map.flyTo(
            [latitude, longitude],
            Math.max(map.getZoom(), 16),
            {
              duration: 1.2,
            }
          )
        }

        setBusy(false)
      },
      () => {
        setBusy(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      }
    )
  }

  return (
    <button
      type="button"
      className="hm-locate-btn"
      onClick={locate}
      disabled={busy}
      aria-label="Tampilkan lokasi saya"
      title="Lokasi saya"
    >
      {busy ? '…' : '⌖'}
    </button>
  )
}

function FlyToLocation({ location, bounds }) {
  const map = useMap()

  useEffect(() => {
    if (bounds && Array.isArray(bounds) && bounds.length === 4) {
      const [south, north, west, east] = bounds.map(Number)
      if (
        Number.isFinite(south) &&
        Number.isFinite(north) &&
        Number.isFinite(west) &&
        Number.isFinite(east) &&
        south < north &&
        west < east
      ) {
        const latLngBounds = L.latLngBounds(
          [south, west],
          [north, east]
        )
        if (typeof map.flyToBounds === 'function') {
          map.flyToBounds(latLngBounds, {
            padding: [48, 48],
            maxZoom: 16,
            duration: 1.15,
          })
        } else {
          map.fitBounds(latLngBounds, {
            padding: [48, 48],
            maxZoom: 16,
            animate: true,
          })
        }
        return
      }
    }
    if (!location) return
    map.flyTo(location, Math.max(map.getZoom(), 15), { duration: 1.1 })
  }, [location, bounds, map])

  return null
}

function SearchLocationMarker({ location }) {
  const map = useMap()
  const [visible, setVisible] = useState(() => map.getZoom() >= DETAIL_MARKER_MIN_ZOOM)
  const icon = L.divIcon({
    className: 'hm-search-marker-wrapper',
    html: '<span class="hm-search-marker"></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

  useEffect(() => {
    const updateVisibility = () => setVisible(map.getZoom() >= DETAIL_MARKER_MIN_ZOOM)
    map.on('zoomend', updateVisibility)
    updateVisibility()
    return () => map.off('zoomend', updateVisibility)
  }, [map])

  return visible ? <Marker position={location} icon={icon} interactive={false} zIndexOffset={900} /> : null
}

function UserLocationMarker({ location }) {
  const map = useMap()
  const [visible, setVisible] = useState(() => map.getZoom() >= DETAIL_MARKER_MIN_ZOOM)
  const icon = L.divIcon({
    className: 'hm-target-pulse-wrapper',
    html: '<span class="hm-target-pulse-ring"></span><span class="hm-target-pulse-core"></span>',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  })

  useEffect(() => {
    const updateVisibility = () => setVisible(map.getZoom() >= DETAIL_MARKER_MIN_ZOOM)
    map.on('zoomend', updateVisibility)
    updateVisibility()
    return () => map.off('zoomend', updateVisibility)
  }, [map])

  return visible ? (
    <Marker
      position={location}
      icon={icon}
      interactive={false}
      zIndexOffset={1000}
    />
  ) : null
}



export default function HazardMap() {
  const { user, role, fullName } = useAuth()

  const [reports, setReports] =
    useState([])

  const [voteCounts, setVoteCounts] =
    useState({})

  const [votedReportIds, setVotedReportIds] =
    useState(() => new Set())

  const [voteBusyId, setVoteBusyId] =
    useState(null)

  const [voteError, setVoteError] =
    useState('')

  const [voteErrorId, setVoteErrorId] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [filter, setFilter] =
    useState('semua')

  const [onlyMine, setOnlyMine] =
    useState(() => getAppSettings().mapView === 'mine' && role !== 'admin')

  const [isFilterOpen, setIsFilterOpen] =
    useState(false)

  const [userLocation, setUserLocation] =
    useState(null)

  const [locationSearch, setLocationSearch] =
    useState('')

  const [locationResults, setLocationResults] =
    useState([])

  const [selectedLocation, setSelectedLocation] =
    useState(null)

  const [locationSearchLoading, setLocationSearchLoading] =
    useState(false)

  const [locationSearchError, setLocationSearchError] =
    useState('')

  const [mapError, setMapError] =
    useState('')

  const [tileError, setTileError] =
    useState(false)

  const [mapLayer, setMapLayer] = useState(() => {
    try {
      return getAppSettings().mapLayer || 'standard'
    } catch {
      return 'standard'
    }
  })

  const [viewingPhoto, setViewingPhoto] =
    useState(null)

  const [activeMarkerId, setActiveMarkerId] =
    useState(null)

  const [searchParams] =
    useSearchParams()

  const markerRefs =
    useRef({})

  const mountedRef =
    useRef(true)

  
  const targetId =
    searchParams.get('id')

  const changeMapLayer = (nextLayer) => {
    setMapLayer(nextLayer)
    setTileError(false)
    saveAppSettings({ mapLayer: nextLayer })
  }

  

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }

    let active = true
    let watchId = null

    const updateLocation = (
      position
    ) => {
      const latitude =
        position.coords.latitude

      const longitude =
        position.coords.longitude

      const location = [
        latitude,
        longitude,
      ]

      if (
        active &&
        isValidCoordinate(
          latitude,
          longitude
        )
      ) {
        setUserLocation(location)
      }
    }

    const requestAccurateLocation =
      () => {
        navigator.geolocation.getCurrentPosition(
          updateLocation,
          () => {},
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          }
        )
      }

    watchId =
      navigator.geolocation.watchPosition(
        updateLocation,
        requestAccurateLocation,
        {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 0,
        }
      )

    return () => {
      active = false

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [])

  

  const fetchReports = async () => {
    setLoading(true)

    try {
      let reportQuery = supabase
        .from('reports')
        .select('id, user_id, reporter_name, reporter_avatar_url, damage_type, latitude, longitude, description, status, created_at, photo_url, completion_photo_url, verified_by, verified_by_name, verified_by_avatar_url, verified_by_role, repairer_id, repairer_name, repairer_avatar_url, repairer_role, hidden_from_map')
        .order(
          'created_at',
          {
            ascending: false,
          }
        )
      let { data, error } = await reportQuery

      if (error?.code === '42703' || error?.message?.includes('avatar_url')) {
        reportQuery = supabase
          .from('reports')
          .select('id, user_id, reporter_name, damage_type, latitude, longitude, description, status, created_at, photo_url, completion_photo_url, verified_by, verified_by_name, verified_by_role, repairer_id, repairer_name, repairer_role, hidden_from_map')
          .order('created_at', { ascending: false })
        ;({ data, error } = await reportQuery)
      }

      if (error) {
        throw error
      }

      if (!mountedRef.current) {
        return
      }

      setReports((data || []).filter((report) => !report.hidden_from_map))

      setMapError('')

      

      const {
        data: voteRows,
        error: voteError,
      } = await supabase
        .from('report_votes')
        .select(
          'report_id, user_id'
        )

      if (voteError) {
        console.warn(
          'Vote laporan belum tersedia:',
          voteError.message
        )
      } else {
        const counts = {}

        const currentUserVotes =
          new Set()

        voteRows.forEach(
          (vote) => {
            counts[vote.report_id] =
              (counts[
                vote.report_id
              ] || 0) + 1

            if (
              vote.user_id ===
              user?.id
            ) {
              currentUserVotes.add(
                vote.report_id
              )
            }
          }
        )

        setVoteCounts(counts)

        setVotedReportIds(
          currentUserVotes
        )
      }
    } catch (error) {
      if (!mountedRef.current) {
        return
      }

      console.error(
        'Gagal mengambil data laporan:',
        error
      )

      setMapError(
        'Laporan jalan belum dapat dimuat. Periksa koneksi lalu coba lagi.'
      )
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true

    if (role === 'admin') {
      setOnlyMine(false)
    }

    fetchReports()

    return () => {
      mountedRef.current = false
    }
  }, [role, user?.id])

  const searchLocation = async (event) => {
    event.preventDefault()
    const rawQuery = locationSearch.trim()
    if (!rawQuery) return

    setLocationSearchLoading(true)
    setLocationSearchError('')
    setLocationResults([])

    const coordinateMatch = rawQuery.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/)
    if (coordinateMatch) {
      const position = [Number(coordinateMatch[1]), Number(coordinateMatch[2])]
      if (isValidCoordinate(...position)) {
        selectLocation({
          id: `coordinates-${position.join('-')}`,
          label: `Koordinat ${position.join(', ')}`,
          position,
          bounds: null,
        })
        setLocationSearchLoading(false)
        return
      }
    }
    const CITY_VIEWBOX = '122.40,-3.88,122.68,-4.12'
    const CITY_CENTER = { lat: -3.99, lon: 122.52 }
    const buildQueryVariants = (q) => {
      const base = q.trim()
      const variants = new Set([base])
      const lower = base.toLowerCase()
      if (lower.includes('puuwatu')) variants.add(base.replace(/puuwatu/gi, 'Puwatu'))
      if (lower.includes('puwatu')) variants.add(base.replace(/puwatu/gi, 'Puuwatu'))
      variants.add(base.replace(/\s+/g, ' '))
      return [...variants]
    }

    const searchNominatim = async (term, { useViewbox = true, bounded = false } = {}) => {
      const params = new URLSearchParams({
        format: 'jsonv2',
        addressdetails: '1',
        limit: '10',
        countrycodes: 'id',
        'accept-language': 'id',
        q: term,
      })
      if (useViewbox) {
        params.set('viewbox', CITY_VIEWBOX)
        params.set('bounded', bounded ? '1' : '0')
      }
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers: { Accept: 'application/json' } }
      )
      if (!response.ok) throw new Error(`Nominatim ${response.status}`)
      return response.json()
    }

    const searchPhoton = async (term) => {
      const params = new URLSearchParams({
        q: term,
        limit: '10',
        lang: 'en',
          lat: String(CITY_CENTER.lat),
          lon: String(CITY_CENTER.lon),
      })
      const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`)
      if (!response.ok) throw new Error(`Photon ${response.status}`)
      const data = await response.json()
      return (data.features || []).map((feature) => {
        const props = feature.properties || {}
        const coords = feature.geometry?.coordinates || []
        const labelParts = [
          props.name,
          props.street,
          props.district || props.suburb || props.locality,
          props.city || props.county,
          props.state,
          props.country,
        ].filter(Boolean)
        return {
          place_id: props.osm_id || feature.id || `${coords[0]}-${coords[1]}`,
          display_name: [...new Set(labelParts)].join(', '),
          lat: coords[1],
          lon: coords[0],
          boundingbox: Array.isArray(props.extent) && props.extent.length === 4
            ? [props.extent[1], props.extent[3], props.extent[0], props.extent[2]]
            : null,
        }
      })
    }

    const normalizeResults = (results) =>
      results
        .map((result) => {
          const lat = Number(result.lat)
          const lon = Number(result.lon)
          if (!isValidCoordinate(lat, lon)) return null
          let bounds = null
          if (Array.isArray(result.boundingbox) && result.boundingbox.length === 4) {
            const bb = result.boundingbox.map(Number)
            if (bb.every(Number.isFinite) && bb[0] < bb[1] && bb[2] < bb[3]) {
              bounds = bb
            }
          }
          const dist =
            Math.abs(lat - CITY_CENTER.lat) + Math.abs(lon - CITY_CENTER.lon)
          return {
            id: String(result.place_id ?? `${lat}-${lon}`),
            label: result.display_name || result.name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
            position: [lat, lon],
            bounds,
            _dist: dist,
          }
        })
        .filter(Boolean)

    try {
      let raw = []
      const variants = buildQueryVariants(rawQuery)
      try {
        for (const v of variants) {
          if (raw.length) break
          raw = await searchNominatim(v, { useViewbox: true, bounded: false })
        }
        if (!raw.length) {
          for (const v of variants) {
            if (raw.length) break
            raw = await searchNominatim(v, { useViewbox: true, bounded: false })
          }
        }
        if (!raw.length) {
          raw = await searchNominatim(`${rawQuery}, Sulawesi Tenggara`, {
            useViewbox: false,
            bounded: false,
          })
        }
        if (!raw.length) {
          raw = await searchNominatim(rawQuery, { useViewbox: false, bounded: false })
        }
      } catch {
        for (const v of variants) {
          if (raw.length) break
          raw = await searchPhoton(v)
        }
        if (!raw.length) raw = await searchPhoton(rawQuery)
      }

      let normalized = normalizeResults(raw)
      normalized.sort((a, b) => a._dist - b._dist)
      const seen = new Set()
      const unique = normalized.filter((item) => {
        const key = `${item.position[0].toFixed(4)},${item.position[1].toFixed(4)}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).map(({ _dist, ...rest }) => rest)

      if (!unique.length) {
        setLocationSearchError(
          'Lokasi tidak ditemukan. Coba: Abeli, Puwatu, Mandonga, Wua-wua, atau nama jalan.'
        )
        setSelectedLocation(null)
      } else {
        setLocationResults(unique)
        selectLocation(unique[0])
      }
    } catch (error) {
      console.warn('Pencarian lokasi:', error)
      setLocationSearchError(
        'Lokasi belum ditemukan. Periksa koneksi lalu coba lagi.'
      )
    } finally {
      setLocationSearchLoading(false)
    }
  }

  const selectLocation = (result) => {
    if (!result?.position) return
    setSelectedLocation({ ...result })
    setLocationSearch(result.label || locationSearch)
  }

  

  
  const targetReport = targetId
    ? reports.find(
        (report) =>
          String(report.id) ===
          String(targetId)
      )
    : null

  
  const targetCoordinates =
    normalizeCoordinates(
      targetReport
    )

  
  const hasValidTarget =
    Boolean(
      targetReport &&
      targetCoordinates
    )

  

  const toggleVote = async (
    reportId
  ) => {
    if (!user) {
      setVoteError(
        'Login untuk mengonfirmasi kerusakan.'
      )

      return
    }

    setVoteBusyId(reportId)

    setVoteError('')

    setVoteErrorId(null)

    const hasVoted =
      votedReportIds.has(
        reportId
      )

    try {
      const result = hasVoted
        ? await supabase
            .from('report_votes')
            .delete()
            .eq(
              'report_id',
              reportId
            )
            .eq(
              'user_id',
              user.id
            )
        : await supabase
            .from('report_votes')
            .insert({
              report_id:
                reportId,
              user_id:
                user.id,
            })

      if (result.error) {
        throw result.error
      }

      setVotedReportIds(
        (previous) => {
          const next =
            new Set(
              previous
            )

          if (hasVoted) {
            next.delete(
              reportId
            )
          } else {
            next.add(
              reportId
            )
          }

          return next
        }
      )

      setVoteCounts(
        (previous) => ({
          ...previous,

          [reportId]:
            Math.max(
              0,
              (
                previous[
                  reportId
                ] || 0
              ) +
                (
                  hasVoted
                    ? -1
                    : 1
                )
            ),
        })
      )

      setVoteErrorId(null)
    } catch (error) {
      console.warn(
        'Vote laporan:',
        error
      )

      setVoteError(
            'Konfirmasi Anda belum tersimpan. Coba lagi sebentar.'
      )

      setVoteErrorId(
        reportId
      )
    } finally {
      setVoteBusyId(null)
    }
  }

  

  const highlightId =
    targetId

  const isAdminRole = role === 'admin'
  const effectiveOnlyMine = isAdminRole ? false : onlyMine

  const filteredReports = useMemo(
    () => reports
      .filter(
        (report) =>
          filter === 'semua' ||
          report.damage_type === filter
      )
      .filter(
        (report) =>
          !effectiveOnlyMine ||
          report.user_id === user?.id
      ),
    [filter, effectiveOnlyMine, reports, user?.id]
  )

  

  const typeCounts = useMemo(
    () => Object.fromEntries(
      Object.keys(
        DAMAGE_TYPES
      ).map(
        (type) => [
          type,
          reports.filter(
            (report) =>
              report.damage_type ===
              type
          ).length,
        ]
      )
    ),
    [reports]
  )

  

  const filterChips = [
    {
      key: 'semua',
      label: 'Semua',
      icon: null,
    },

    ...Object.entries(
      DAMAGE_TYPES
    ).map(
      ([key, meta]) => ({
        key,
        label: meta.label,
        icon: meta.icon,
      })
    ),
  ]

  

  const mapCopy = role === 'admin'
    ? {
        kicker: 'PETA INSTANSI',
        title: 'Pantau kondisi jalan',
        description: 'Tinjau laporan warga, lokasi kerusakan, dan status penanganan untuk mendukung keputusan lapangan.',
      }
    : role === 'community'
      ? {
          kicker: 'PETA RELAWAN',
          title: 'Temukan jalan yang perlu dibantu',
          description: 'Pilih temuan warga di sekitar Anda untuk divalidasi dan ditangani bersama komunitas.',
        }
      : role === 'user'
        ? {
            kicker: 'PETA WARGA',
            title: 'Lihat kondisi jalan sekitar',
            description: 'Pantau laporan warga, konfirmasi temuan, dan lihat perkembangan perbaikan jalan.',
          }
        : {
            kicker: 'PETA PUBLIK',
            title: 'Lihat kondisi jalan',
            description: 'Lihat laporan kerusakan jalan di sekitar Anda berdasarkan jenis dan statusnya.',
          }

  return (
    <div className="hm-page">
      <Navbar />

      <div className="hm-content">

        {}

        <section className="hm-hero">
          <div
            className="hm-hero-glow"
            aria-hidden="true"
          />

          <div className="hm-hero-copy">
            <span className="hm-kicker">{mapCopy.kicker}</span>

            <h1>{mapCopy.title}</h1>

            <p>{mapCopy.description}</p>
          </div>

          <div
            className="hm-hero-icon"
            aria-hidden="true"
          >
            <img
              src="/icons/peta.svg"
              alt=""
            />
          </div>
        </section>

        {}

        <section
          className="hm-filter-drawer"
          aria-label="Filter peta"
        >
          <button
            type="button"
            className={`hm-filter-toggle ${
              isFilterOpen
                ? 'active'
                : ''
            }`}
            aria-expanded={
              isFilterOpen
            }
            aria-controls="hm-filter-options"
            onClick={() =>
              setIsFilterOpen(
                (previous) =>
                  !previous
              )
            }
          >
            <span
              className="hm-filter-toggle-icon"
              aria-hidden="true"
            >
              ⌯
            </span>

            <span>
              Setelan Peta
            </span>

            <span className="hm-filter-toggle-value">
              {filter === 'semua' &&
              !onlyMine
                ? 'Semua laporan'
                : 'Filter aktif'}
            </span>

            <span
              className="hm-filter-toggle-arrow"
              aria-hidden="true"
            >
              {isFilterOpen
                ? '−'
                : '+'}
            </span>
          </button>

          {isFilterOpen && (
            <div
              className="hm-filters-panel"
              id="hm-filter-options"
            >
              <div className="hm-layer-switch" role="group" aria-label="Pilih tampilan peta">
                <span className="hm-filters-label">Tampilan peta</span>
                <div className="hm-layer-options">
                  <button
                    type="button"
                    className={mapLayer === 'standard' ? 'active' : ''}
                    onClick={() => changeMapLayer('standard')}
                    aria-pressed={mapLayer === 'standard'}
                  >
                    Standar
                  </button>
                  <button
                    type="button"
                    className={mapLayer === 'satellite' ? 'active' : ''}
                    onClick={() => changeMapLayer('satellite')}
                    aria-pressed={mapLayer === 'satellite'}
                  >
                    Satelit
                  </button>
                </div>
              </div>

              <span className="hm-filters-label">
                Filter Peta
              </span>

              <div className="hm-chip-row">
                {filterChips.map(
                  (chip) => (
                    <button
                      type="button"
                      key={
                        chip.key
                      }
                      className={`hm-chip hm-chip-${
                        chip.key
                      } ${
                        filter ===
                        chip.key
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setFilter(
                          chip.key
                        )
                      }
                    >
                      {chip.icon && (
                        <img
                          src={
                            chip.icon
                          }
                          alt=""
                          className="hm-chip-icon"
                        />
                      )}

                      {chip.label}
                    </button>
                  )
                )}

                {!isAdminRole && (
                  <button
                    type="button"
                    className={`hm-chip hm-chip-mine ${
                      effectiveOnlyMine
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      setOnlyMine(
                        (prev) =>
                          !prev
                      )
                    }
                  >
                    <img
                      src="/icons/profil.svg"
                      alt=""
                      className="hm-chip-icon"
                    />

                    Laporan saya
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="hm-location-search" aria-label="Cari lokasi di peta">
          <form className="hm-location-search-form" onSubmit={searchLocation}>
            <span className="hm-location-search-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={locationSearch}
              onChange={(event) => setLocationSearch(event.target.value)}
              placeholder="Cari lokasi, jalan, atau area..."
              aria-label="Cari lokasi"
            />
            <button type="submit" disabled={locationSearchLoading}>
              {locationSearchLoading ? 'Mencari...' : 'Cari'}
            </button>
          </form>
          {locationSearchError && (
            <p className="hm-location-search-error" role="alert">
              {locationSearchError}
            </p>
          )}
          {locationResults.length > 0 && (
            <div className="hm-location-results" role="listbox" aria-label="Hasil pencarian lokasi">
              <div className="hm-location-results-header">
                <span>Hasil — peta sudah dipindahkan ke area terbaik</span>
                <button
                  type="button"
                  className="hm-location-results-close"
                  onClick={() => setLocationResults([])}
                  aria-label="Tutup hasil pencarian"
                >
                  ✕
                </button>
              </div>
              {locationResults.map((result, index) => (
                <button
                  type="button"
                  key={result.id}
                  onClick={() => {
                    selectLocation(result)
                    setLocationResults([])
                  }}
                  role="option"
                  className={
                    selectedLocation?.id === result.id
                      ? 'hm-location-result-active'
                      : undefined
                  }
                >
                  <span className="hm-location-result-pin" aria-hidden="true">
                    {index === 0 ? '★' : '•'}
                  </span>
                  <span>{result.label}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="hm-status-legend" aria-label="Legenda status laporan">
          <span className="hm-status-legend-title">Status laporan</span>
          <div className="hm-status-legend-items">
            {Object.entries(statusColors).map(([status, color]) => (
              <span className="hm-status-legend-item" key={status}>
                <span className="hm-status-legend-dot" style={{ '--status-color': color }} aria-hidden="true" />
                {status}
              </span>
            ))}
          </div>
        </section>

        {}

        {mapError && (
          <div
            className="hm-error"
            role="alert"
          >
            <span>
              {mapError}
            </span>

            <button
              type="button"
              onClick={
                fetchReports
              }
            >
              Coba lagi
            </button>
          </div>
        )}

        {}

        {loading ? (
          <div
            className="hm-loading"
            role="status"
          >
            <div
              className="hm-loading-spinner"
              aria-hidden="true"
            />

            Memuat peta laporan...
          </div>
        ) : (
          <div
            className="hm-map-shell"
          >
            <div className="hm-map-container">

              <MapContainer
                scrollWheelZoom={false}
                touchZoom={true}
                center={
                  hasValidTarget
                    ? targetCoordinates
                    : userLocation ||
                      DEFAULT_CENTER
                }
                zoom={
                  hasValidTarget
                    ? FOCUS_ZOOM
                    : 13
                }
                style={{
                  height: '100%',
                  width: '100%',
                  minHeight: '500px',
                }}
              >

                {}

                <SyncMapSize />
                <SyncMapZoomClass />

                <CenterOnLocation
                  location={
                    userLocation
                  }
                  enabled={
                    !hasValidTarget
                  }
                />

                {}

                <LocateMeButton />
                {userLocation && (
                  <UserLocationMarker location={userLocation} />
                )}
                <FlyToLocation
                  location={selectedLocation?.position}
                  bounds={selectedLocation?.bounds}
                />
                {selectedLocation && (
                  <SearchLocationMarker location={selectedLocation.position} />
                )}

                {}

                {mapLayer === 'satellite' ? (
                  <TileLayer
                    key="satellite"
                    attribution='Tiles &copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    eventHandlers={{ error: () => setTileError(true) }}
                  />
                ) : (
                  <TileLayer
                    key="standard"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    eventHandlers={{ error: () => setTileError(true) }}
                  />
                )}

                {}

                {hasValidTarget && (
                  <FlyToReport
                    targetReport={
                      targetReport
                    }
                    markerRefs={
                      markerRefs
                    }
                  />
                )}

                {}

                <MarkerClusterGroup
                  chunkedLoading
                  maxClusterRadius={(zoom) => zoom <= 10 ? 100 : 45}
                  showCoverageOnHover={
                    false
                  }
                  spiderfyOnMaxZoom
                  iconCreateFunction={
                    createClusterIcon
                  }
                >

                  {filteredReports
                    .map(
                      (
                        report
                      ) => {
                        
                        const coordinates =
                          normalizeCoordinates(
                            report
                          )

                        
                        if (
                          !coordinates
                        ) {
                          return null
                        }

                        const isHighlighted =
                          highlightId &&
                          String(
                            report.id
                          ) ===
                            String(
                              highlightId
                            )

                        const isDone =
                          report.status ===
                            'Selesai' &&
                          report.completion_photo_url

                        const popupPhoto =
                          isDone
                            ? report.completion_photo_url
                            : report.photo_url
                        const reporterName = report.reporter_name || (report.user_id === user?.id ? fullName : null) || 'Warga SIJAKA'
                        const verifiedName = report.verified_by_name || (report.verified_by === user?.id ? fullName : null)
                        const repairerName = report.repairer_name || (report.repairer_id === user?.id ? fullName : null)
                        const verifiedRole = report.verified_by_role || (report.verified_by === user?.id ? role : null)
                        const repairerRole = report.repairer_role || (report.repairer_id === user?.id ? role : null)

                        return (
                          <Marker
                            key={
                              report.id
                            }
                            
                            position={
                              coordinates
                            }
                            icon={
                              activeMarkerId === report.id
                                ? createIcon(
                                    report.damage_type === 'retak' || report.damage_type === 'marka'
                                      ? 'yellow'
                                      : report.damage_type === 'banjir' || report.damage_type === 'drainase'
                                        ? 'blue'
                                        : 'red',
                                    'hm-report-marker hm-report-marker-active'
                                  )
                                : damageIcons[
                                    report
                                      .damage_type
                                  ] ||
                                  damageIcons.lubang
                            }
                            zIndexOffset={
                              isHighlighted
                                ? 1000
                                : 0
                            }
                            ref={(
                              el
                            ) => {
                              if (
                                el
                              ) {
                                markerRefs.current[
                                  report.id
                                ] =
                                  el
                              }
                            }}
                          >

                            {}

                            <Popup
                              minWidth={
                                220
                              }
                              maxWidth={
                                320
                              }
                              closeButton
                              closeOnClick={false}
                              autoPan={false}
                              eventHandlers={{
                                popupopen: () => setActiveMarkerId(report.id),
                                popupclose: () => setActiveMarkerId((currentId) => currentId === report.id ? null : currentId),
                              }}
                            >
                              <div className="hm-popup-content">

                                {}

                                {popupPhoto && (
                                  <button
                                    type="button"
                                    className="hm-popup-photo-button"
                                    onClick={() => setViewingPhoto({
                                      src: popupPhoto,
                                      alt: isDone ? 'Bukti selesai' : 'Kerusakan',
                                    })}
                                  >
                                    Tampilkan gambar
                                  </button>
                                )}

                                {}

                                <div className="hm-popup-header">

                                  <div className="hm-popup-type">

                                    <span className="hm-popup-damage-icon-wrap">
                                      <img
                                        src={
                                          damageMeta[
                                            report
                                              .damage_type
                                          ]?.icon ||
                                          '/icons/lubang.svg'
                                        }
                                        alt=""
                                        className="hm-popup-damage-icon"
                                      />
                                    </span>

                                    <span>
                                      <small>
                                        JENIS
                                        KERUSAKAN
                                      </small>

                                      <strong>
                                        {damageMeta[
                                          report
                                            .damage_type
                                        ]?.label ||
                                          report.damage_type}
                                      </strong>
                                    </span>

                                  </div>

                                  <span
                                    className="hm-popup-status"
                                    style={{
                                      background:
                                        statusColors[
                                          report
                                            .status
                                        ] ||
                                        '#94a3b8',
                                    }}
                                  >
                                    {
                                      report.status
                                    }
                                  </span>

                                </div>

                                {}

                                {report.description && (
                                  <p className="hm-popup-description">
                                    {
                                      report.description
                                    }
                                  </p>
                                )}

                                {}

                                <div className="hm-popup-details">

                                  <p className="hm-popup-responsibility">
                                    <span>Pelapor</span>
                                    <strong className="hm-popup-reporter">
                                      {report.reporter_avatar_url ? <img src={report.reporter_avatar_url} alt="" /> : <span className="hm-popup-reporter-fallback">{reporterName.slice(0, 1).toUpperCase()}</span>}
                                      {reporterName}
                                    </strong>
                                  </p>

                                  <p className="hm-popup-responsibility">
                                    <span>
                                      Diverifikasi
                                    </span>

                                    <strong className="hm-popup-reporter">
                                      {report.verified_by_avatar_url ? <img src={report.verified_by_avatar_url} alt="" /> : <span className="hm-popup-reporter-fallback">{(verifiedName || 'V').slice(0, 1).toUpperCase()}</span>}
                                      {verifiedName
                                        ? `${verifiedName}${
                                            roleLabel(
                                              verifiedRole
                                            )
                                              ? ` · ${roleLabel(
                                                  verifiedRole
                                                )}`
                                              : ''
                                          }`
                                        : 'Belum diverifikasi'}
                                    </strong>
                                  </p>

                                  <p className="hm-popup-responsibility">
                                    <span>
                                      Ditangani
                                    </span>

                                    <strong className="hm-popup-reporter">
                                      {report.repairer_avatar_url ? <img src={report.repairer_avatar_url} alt="" /> : <span className="hm-popup-reporter-fallback">{(repairerName || 'P').slice(0, 1).toUpperCase()}</span>}
                                      {repairerName
                                        ? `${repairerName}${
                                            roleLabel(
                                              repairerRole
                                            )
                                              ? ` · ${roleLabel(
                                                  repairerRole
                                                )}`
                                              : ''
                                          }`
                                        : 'Belum ditangani'}
                                    </strong>
                                  </p>

                                </div>

                                {}

                                <p className="hm-popup-date">
                                  Dilaporkan{' '}
                                  {new Date(
                                    report.created_at
                                  ).toLocaleDateString(
                                    'id-ID',
                                    {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    }
                                  )}
                                </p>

                                {}

                                <div className="hm-vote-section">

                                  <button
                                    type="button"
                                    className={`hm-vote-button ${
                                      votedReportIds.has(
                                        report.id
                                      )
                                        ? 'active'
                                        : ''
                                    }`}
                                    onClick={() =>
                                      toggleVote(
                                        report.id
                                      )
                                    }
                                    disabled={
                                      voteBusyId ===
                                      report.id
                                    }
                                  >
                                    <span
                                      aria-hidden="true"
                                    >
                                      ✓
                                    </span>

                                    {votedReportIds.has(
                                      report.id
                                    )
                                      ? 'Terkonfirmasi'
                                      : 'Konfirmasi kerusakan'}

                                    <b>
                                      {voteCounts[
                                        report.id
                                      ] ||
                                        0}
                                    </b>
                                  </button>

                                  {!user && (
                                    <small className="hm-vote-hint">
                                      Login untuk
                                      ikut
                                      mengonfirmasi
                                    </small>
                                  )}

                                  {voteError &&
                                    voteErrorId ===
                                      report.id && (
                                      <small className="hm-vote-error">
                                        {
                                          voteError
                                        }
                                      </small>
                                    )}

                                </div>

                              </div>
                            </Popup>

                          </Marker>
                        )
                      }
                    )}

                </MarkerClusterGroup>

              </MapContainer>

            </div>
            {tileError && (
              <div className="hm-tile-fallback" role="status">
                Peta dasar sedang sulit dimuat. Daftar laporan dan pencarian tetap dapat digunakan.
                <button type="button" onClick={() => window.location.reload()}>Coba lagi</button>
              </div>
            )}
          </div>
        )}

        {}

        <div className="hm-stats-strip">

          <div className="hm-stat">
            <strong>
              {loading
                ? '—'
                : filteredReports.length}
            </strong>

            <span>
              DITAMPILKAN
            </span>
          </div>

          {Object.entries(
            DAMAGE_TYPES
          ).map(
            ([type, meta]) => (
              <div
                className="hm-stat"
                key={type}
              >
                <strong>
                  {loading
                    ? '—'
                    : typeCounts[
                        type
                      ]}
                </strong>

                <span>
                  {meta.label}
                </span>
              </div>
            )
          )}

        </div>

        {viewingPhoto && (
          <div className="hm-photo-viewer" role="dialog" aria-modal="true" aria-label="Gambar laporan">
            <button
              type="button"
              className="hm-photo-viewer-backdrop"
              aria-label="Tutup gambar"
              onClick={() => setViewingPhoto(null)}
            />
            <div className="hm-photo-viewer-panel">
              <img src={viewingPhoto.src} alt={viewingPhoto.alt} className="hm-photo-viewer-image" />
              <button type="button" className="hm-photo-viewer-close" onClick={() => setViewingPhoto(null)}>
                Tutup
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}



function roleLabel(role) {
  if (
    role === 'community'
  ) {
    return 'Komunitas'
  }

  if (role === 'admin') {
    return 'Instansi'
  }

  return ''
}