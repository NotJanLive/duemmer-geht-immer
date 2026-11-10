'use client';

import { useEffect } from 'react';
import { GameState } from '@/types/game';
import { play, unlockAudio } from './sounds';
import { useRoomStore } from './store';

// Plays sounds for what just happened, by comparing each new state with the
// previous one. Same for host, players and OBS.
function soundsFor(prev: GameState, next: GameState) {
  if (prev.screen !== next.screen) {
    if (next.screen !== 'finale') play('whoosh');
    return;
  }
  // No effects over the finale.
  if (next.screen === 'finale') return;

  // Songrätsel: short cues between the snippets.
  const ps = prev.song, ns = next.song;
  if (ps && ns) {
    if (ps.roundIndex !== ns.roundIndex || ps.itemIndex !== ns.itemIndex) return play('whoosh');
    if (ns.revealed && !ps.revealed) return play('reveal');
    if (Object.keys(ns.guesses).length > Object.keys(ps.guesses).length) return play('lock');
    if (ns.stage > ps.stage) return play('pop');
    if (ns.extend.length > ps.extend.length) return play('pop');
    return;
  }

  const pj = prev.jeo, nj = next.jeo;
  if (pj && nj) {
    const answered = (s: typeof nj) => s.categories.flatMap((c) => c.questions).filter((q) => q.status === 'answered').length;
    if (answered(nj) > answered(pj)) return play('correct');
    if (nj.active && pj.active) {
      if (nj.active.tried.length > pj.active.tried.length || (!nj.active.firstAttempt && pj.active.firstAttempt && nj.active.points < pj.active.points)) return play('wrong');
      if (nj.active.answeringId && !pj.active.answeringId && pj.active.buzzerOpen) return play('buzz');
    }
    if (nj.active && !pj.active) return play('reveal');
  }

  const pp = prev.pic, np = next.pic;
  if (pp && np && pp.itemIndex === np.itemIndex && pp.roundIndex === np.roundIndex) {
    if (np.winnerId && !pp.winnerId) return play('correct');
    const wrong = (s: typeof np) => s.queue.filter((b) => b.wrong).length;
    if (wrong(np) > wrong(pp)) return play('wrong');
    if (np.queue.length > pp.queue.length) return play('buzz');
  }

  const pw = prev.wwm, nw = next.wwm;
  if (pw && nw && pw.index === nw.index) {
    // Only the reveal makes a sound, not the single answers.
    if (nw.revealed && !pw.revealed) return play('reveal');
    return;
  }

  const pl = prev.lms, nl = next.lms;
  if (pl && nl && pl.roundIndex === nl.roundIndex) {
    const r0 = pl.rounds[pl.roundIndex], r1 = nl.rounds[nl.roundIndex];
    if (r1.eliminated.length > r0.eliminated.length) return play('wrong');
    if (r1.cards.filter((c) => c.revealed).length > r0.cards.filter((c) => c.revealed).length) return play('pop');
  }

  const ph = prev.hol, nh = next.hol;
  if (ph && nh && ph.roundIndex === nh.roundIndex) {
    const lives = (s: typeof nh) => Object.values(s.lives).reduce((a, b) => a + b, 0);
    if (lives(nh) < lives(ph)) return play('wrong');
    const placed = (s: typeof nh) => s.rounds[s.roundIndex].items.filter((i) => i.placed).length;
    if (placed(nh) > placed(ph)) return play('pop');
  }

  if (prev.geo && next.geo && next.geo.revealed && !prev.geo.revealed) return play('reveal');


  // Points given by hand (HoL, Jeopardy) without another sound above.
  const total = (s: GameState) => s.players.reduce((a, p) => a + p.modeScore, 0);
  if (total(next) > total(prev)) return play('correct');
  if (total(next) < total(prev)) return play('wrong');
}

export function useShowSounds() {
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    unlockAudio(); // OBS allows audio without a gesture
    const unsub = useRoomStore.subscribe((s, before) => {
      if (s.state && before.state && s.state !== before.state && s.state.showId === before.state.showId) {
        soundsFor(before.state, s.state);
      }
    });
    return () => {
      unsub();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}
