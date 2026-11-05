"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { CircleMarker, LayerGroup, Map as LeafletMap } from "leaflet";
import { MAPS, MapId } from "@/types/pool";

type Leaflet = typeof import("leaflet");

// A real street map (OpenStreetMap) for placing locations in the admin. Only
// the admin loads it; the game itself uses the outline map without labels.
export default function PlaceMap({
  region,
  places,
  selected,
  focus,
  onPick,
  onSelect,
}: {
  region: MapId;
  places: { name: string; lat: number; lng: number }[];
  selected: number | null;
  focus: { lat: number; lng: number; key: number } | null; // fly here when key changes
  onPick: (pos: { lat: number; lng: number }) => void;
  onSelect: (i: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: Leaflet; map: LeafletMap; layer: LayerGroup } | null>(null);
  const handlers = useRef({ onPick, onSelect });

  useEffect(() => {
    handlers.current = { onPick, onSelect };
  });

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !box.current) return;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (e) => handlers.current.onPick({ lat: Math.round(e.latlng.lat * 10000) / 10000, lng: Math.round(e.latlng.lng * 10000) / 10000 }));
      leaflet.current = { L, map, layer: L.layerGroup().addTo(map) };
      const [w, s, e, n] = MAPS[region].view;
      map.fitBounds([[s, w], [n, e]]);
      draw();
    });
    return () => {
      cancelled = true;
      leaflet.current?.map.remove();
      leaflet.current = null;
    };
    // The map is created once; region, places and focus are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const l = leaflet.current;
    if (!l) return;
    const [w, s, e, n] = MAPS[region].view;
    l.map.fitBounds([[s, w], [n, e]]);
  }, [region]);

  useEffect(() => {
    if (focus && leaflet.current) leaflet.current.map.flyTo([focus.lat, focus.lng], Math.max(leaflet.current.map.getZoom(), 12), { duration: 0.6 });
  }, [focus]);

  function draw() {
    const l = leaflet.current;
    if (!l) return;
    l.layer.clearLayers();
    places.forEach((p, i) => {
      const active = i === selected;
      const marker: CircleMarker = l.L.circleMarker([p.lat, p.lng], {
        radius: active ? 9 : 6,
        color: "#000",
        weight: 1.5,
        fillColor: active ? "#2563eb" : "#ea4335",
        fillOpacity: 1,
      });
      marker.bindTooltip(p.name, { direction: "top", offset: [0, -8], permanent: active });
      marker.on("click", (e) => {
        l.L.DomEvent.stopPropagation(e);
        handlers.current.onSelect(i);
      });
      marker.addTo(l.layer);
    });
  }

  useEffect(draw);

  return <div ref={box} className="h-[28rem] w-full overflow-hidden rounded-xl border border-line" />;
}
