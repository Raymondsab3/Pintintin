/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Trophy, 
  History, 
  MessageCircle, 
  Plus, 
  Trash2, 
  X, 
  Share2, 
  AlertCircle, 
  Crown, 
  RotateCcw,
  ChevronRight,
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { Player, GameHistoryEntry, ActiveGame, ChatMessage, UserRole } from './types';

let socket: Socket;

export default function App() {
  // Auth State
  const [role, setRole] = useState<UserRole>(null);
  const [username, setUsername] = useState(() => localStorage.getItem('pintintin_username') || '');
  const [password, setPassword] = useState('');

  // Data State
  const [players, setPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [globalGameCount, setGlobalGameCount] = useState(0);
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<Player | null>(null);
  const [userCount, setUserCount] = useState(1);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [selectedForNewGame, setSelectedForNewGame] = useState<string[]>([]);

  // Persistence
  useEffect(() => {
    const savedPlayers = localStorage.getItem('pintintin_players');
    const savedHistory = localStorage.getItem('pintintin_history');
    const savedCount = localStorage.getItem('pintintin_count');
    const savedActive = localStorage.getItem('pintintin_active');

    if (savedPlayers) setPlayers(JSON.parse(savedPlayers));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedCount) setGlobalGameCount(parseInt(savedCount));
    if (savedActive) setActiveGame(JSON.parse(savedActive));

    // Initialize Socket
    socket = io();
    socket.on('user_count', (count: number) => setUserCount(count));
    socket.on('receive_message', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('pintintin_players', JSON.stringify(players));
    localStorage.setItem('pintintin_history', JSON.stringify(history));
    localStorage.setItem('pintintin_count', globalGameCount.toString());
    localStorage.setItem('pintintin_active', JSON.stringify(activeGame));
    localStorage.setItem('pintintin_username', username);
  }, [players, history, globalGameCount, activeGame, username]);

  // Handlers
  const addPlayer = (name: string) => {
    if (!name.trim()) return;
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: name.trim(),
      losses: 0
    };
    setPlayers([...players, newPlayer]);
  };

  const deletePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
    if (activeGame?.players.some(p => p.id === id)) {
      setActiveGame(null);
    }
  };

  const startNewGame = (playerIds: string[]) => {
    if (playerIds.length !== 3) return;
    const gamePlayers = players
      .filter(p => playerIds.includes(p.id))
      .map(p => ({ id: p.id, name: p.name, score: 0 }));
    
    setActiveGame({
      id: crypto.randomUUID(),
      players: gamePlayers,
      isFinished: false
    });
  };

  const updateScore = (playerId: string, points: number) => {
    if (!activeGame) return;
    
    const updatedPlayers = activeGame.players.map(p => 
      p.id === playerId ? { ...p, score: p.score + points } : p
    );

    const winner = updatedPlayers.find(p => p.score >= 150);
    
    if (winner) {
      const others = updatedPlayers.filter(p => p.id !== winner.id);
      const scores = others.map(o => o.score);
      const minScore = Math.min(...scores);
      const losers = others.filter(o => o.score === minScore);

      if (losers.length > 1) {
        setActiveGame({
          ...activeGame,
          players: updatedPlayers,
          isFinished: false,
          winnerId: winner.id,
          tieForLoser: true
        });
      } else {
        finishGame(updatedPlayers, winner.id, losers[0].id, 'points');
      }
    } else {
      setActiveGame({ ...activeGame, players: updatedPlayers });
    }
  };

  const handleFoul = (playerId: string, foulType: string) => {
    if (!activeGame) return;
    const others = activeGame.players.filter(p => p.id !== playerId);
    finishGame(activeGame.players, others[0].id, playerId, 'foul', foulType);
  };

  const finishGame = (
    finalPlayers: ActiveGame['players'], 
    winnerId: string, 
    loserId: string, 
    lossType: 'points' | 'foul',
    foulType?: string
  ) => {
    const finalScores: Record<string, number> = {};
    finalPlayers.forEach(p => finalScores[p.name] = p.score);

    const newHistoryEntry: GameHistoryEntry = {
      id: crypto.randomUUID(),
      playerId: loserId,
      opponents: finalPlayers.filter(p => p.id !== loserId).map(p => p.name),
      finalScores,
      lossType,
      foulType,
      date: Date.now()
    };

    setHistory([newHistoryEntry, ...history]);
    setPlayers(players.map(p => p.id === loserId ? { ...p, losses: p.losses + 1 } : p));
    setGlobalGameCount(prev => prev + 1);
    setActiveGame({
      ...activeGame!,
      players: finalPlayers,
      isFinished: true,
      winnerId,
      loserId,
      tieForLoser: false
    });
  };

  const resetGlobalCounter = () => {
    if (confirm('¿Estás seguro de reiniciar el contador global?')) {
      setGlobalGameCount(0);
    }
  };

  const shareGame = () => {
    const url = `${window.location.origin}?game=${activeGame?.id || 'live'}`;
    navigator.clipboard.writeText(url);
    alert('¡Link de invitación copiado al portapapeles!');
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      user: username || 'Anónimo',
      text,
      timestamp: Date.now()
    };
    socket.emit('send_message', newMessage);
  };

  const downloadHTML = () => {
    const htmlContent = document.documentElement.outerHTML;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pintintin.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Views
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tighter">Pintintin</h1>
            <p className="text-zinc-500 italic">El juego de los 150 puntos</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nombre de Usuario</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: El Rey del Pintintin"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
              />
            </div>

            <div className="space-y-2 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Contraseña (Solo Admin/Usuario)</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => {
                  if (username === 'Raymond' && password === 'Gca$3nxa') {
                    setRole('admin');
                  } else {
                    setRole('user');
                  }
                }}
                disabled={!username.trim()}
                className="btn-primary flex flex-col items-center gap-2 py-6"
              >
                <UserCircle size={24} />
                <span>Entrar</span>
              </button>
              <button 
                onClick={() => setRole('guest')}
                className="btn-secondary flex flex-col items-center gap-2 py-6"
              >
                <Users size={24} />
                <span>Invitado</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-zinc-50">
      {/* Sidebar: Player Management */}
      <aside className="w-full lg:w-80 border-r border-zinc-200 bg-white flex flex-col h-screen sticky top-0">
        <div className="p-6 border-bottom border-zinc-100 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Jugadores</h2>
          <div className="flex items-center gap-2 text-zinc-400">
            <Trophy size={16} />
            <span className="text-sm font-mono">{globalGameCount}</span>
          </div>
        </div>

        {(role === 'user' || role === 'admin') && (
          <div className="px-6 pb-4">
            <form onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('playerName') as HTMLInputElement;
              addPlayer(input.value);
              input.value = '';
            }} className="relative">
              <input 
                name="playerName"
                type="text" 
                placeholder="Nuevo jugador..."
                className="w-full pl-4 pr-10 py-2 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900">
                <Plus size={20} />
              </button>
            </form>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-20">
          {players
            .sort((a, b) => b.losses - a.losses)
            .map(player => (
              <div 
                key={player.id}
                onClick={() => setSelectedPlayerHistory(player)}
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 cursor-pointer transition-colors border border-transparent hover:border-zinc-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{player.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{player.losses} Derrotas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(role === 'user' || role === 'admin') && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); deletePlayer(player.id); }}
                      className="text-zinc-300 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <ChevronRight size={14} className="text-zinc-300" />
                </div>
              </div>
            ))}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 space-y-3">
          {role === 'admin' && (
            <button 
              onClick={downloadHTML}
              className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <Plus size={12} />
              Descargar HTML
            </button>
          )}
          <button 
            onClick={resetGlobalCounter}
            className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            <RotateCcw size={12} />
            Reiniciar Contador
          </button>
        </div>
      </aside>

      {/* Main Content: Game Board */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Tablero Principal</h1>
              <p className="text-zinc-500">Gestiona tu partida en tiempo real</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={shareGame} className="btn-secondary flex items-center gap-2">
                <Share2 size={18} />
                <span>Compartir</span>
              </button>
              {(role === 'user' || role === 'admin') && !activeGame && (
                <button 
                  onClick={() => setShowPlayerSelection(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus size={18} />
                  <span>Nueva Partida</span>
                </button>
              )}
            </div>
          </header>

          {!activeGame ? (
            <div className="card flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300">
                <Users size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">No hay partida activa</h3>
                <p className="text-zinc-400 text-sm max-w-xs">
                  {(role === 'user' || role === 'admin') 
                    ? 'Selecciona 3 jugadores de tu lista para comenzar una nueva partida.' 
                    : 'Espera a que el anfitrión inicie una nueva partida.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {activeGame.players.map((player) => {
                  const isWinner = activeGame.winnerId === player.id;
                  const isLoser = activeGame.loserId === player.id;
                  
                  return (
                    <motion.div 
                      layout
                      key={player.id} 
                      className={`card relative overflow-hidden transition-all ${
                        isWinner ? 'ring-2 ring-emerald-500 bg-emerald-50/30' : 
                        isLoser ? 'ring-2 ring-red-500 bg-red-50/30' : ''
                      }`}
                    >
                      {isWinner && (
                        <div className="absolute top-2 right-2 text-emerald-600">
                          <Crown size={20} />
                        </div>
                      )}
                      {isLoser && (
                        <div className="absolute top-2 right-2 text-red-600">
                          <AlertCircle size={20} />
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="text-center">
                          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Jugador</p>
                          <h3 className="text-xl font-bold">{player.name}</h3>
                        </div>

                        <div className="text-center py-6 bg-zinc-50 rounded-xl">
                          <p className="text-4xl font-black tracking-tighter">{player.score}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Puntos</p>
                        </div>

                        {!activeGame.isFinished && (role === 'user' || role === 'admin') && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                              {[5, 10, 20, 50].map(val => (
                                <button 
                                  key={val}
                                  onClick={() => updateScore(player.id, val)}
                                  className="btn-secondary text-xs py-2"
                                >
                                  +{val}
                                </button>
                              ))}
                            </div>
                            
                            <div className="pt-4 border-t border-zinc-100 space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-center">Faltas Especiales</p>
                              <div className="flex flex-col gap-1">
                                <button 
                                  onClick={() => handleFoul(player.id, 'Pase con ficha')}
                                  className="text-[10px] font-semibold py-1.5 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  Pase con ficha
                                </button>
                                <button 
                                  onClick={() => handleFoul(player.id, 'Jugo adelantado')}
                                  className="text-[10px] font-semibold py-1.5 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  Jugo adelantado
                                </button>
                                <button 
                                  onClick={() => handleFoul(player.id, 'Chivo')}
                                  className="text-[10px] font-semibold py-1.5 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  Chivo
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {activeGame.tieForLoser && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 text-amber-800"
                >
                  <AlertCircle className="shrink-0" />
                  <div>
                    <p className="font-bold">¡Empate Técnico!</p>
                    <p className="text-sm">Los otros dos jugadores tienen el mismo puntaje. Juega una <span className="font-bold underline">mano extra</span> para decidir quién pierde.</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    {activeGame.players.filter(p => p.id !== activeGame.winnerId).map(p => (
                      <button 
                        key={p.id}
                        onClick={() => finishGame(activeGame.players, activeGame.winnerId!, p.id, 'points')}
                        className="bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                      >
                        {p.name} pierde
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeGame.isFinished && (
                <div className="flex justify-center pt-8">
                  <button 
                    onClick={() => setActiveGame(null)}
                    className="btn-primary flex items-center gap-2 px-8 py-4 text-lg"
                  >
                    <RotateCcw size={20} />
                    <span>Cerrar Partida</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Floating Chat */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-80 h-96 glass rounded-2xl flex flex-col overflow-hidden shadow-2xl border-zinc-200"
            >
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-900 text-white">
                <div className="flex items-center gap-2">
                  <MessageCircle size={18} />
                  <span className="font-bold text-sm tracking-tight">Chat ({userCount} online)</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:text-zinc-300">
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map(msg => (
                  <div key={msg.id} className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{msg.user}</p>
                    <div className="bg-zinc-100 p-3 rounded-2xl rounded-tl-none text-sm">
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2">
                    <MessageCircle size={24} opacity={0.5} />
                    <p className="text-xs">No hay mensajes aún</p>
                  </div>
                )}
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('chatInput') as HTMLInputElement;
                  sendMessage(input.value);
                  input.value = '';
                }}
                className="p-4 border-t border-zinc-100 bg-white"
              >
                <input 
                  name="chatInput"
                  type="text" 
                  placeholder="Escribe algo..."
                  className="w-full px-4 py-2 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
                />
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-xl hover:scale-110 transition-all active:scale-95"
        >
          <MessageCircle size={24} />
        </button>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showPlayerSelection && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPlayerSelection(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Seleccionar 3 Jugadores</h2>
                <button onClick={() => setShowPlayerSelection(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 max-h-[50vh] overflow-y-auto space-y-2">
                {players.map(player => (
                  <label 
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedForNewGame.includes(player.id) 
                        ? 'border-zinc-900 bg-zinc-50' 
                        : 'border-zinc-100 hover:border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold">
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{player.name}</span>
                    </div>
                    <input 
                      type="checkbox"
                      className="hidden"
                      checked={selectedForNewGame.includes(player.id)}
                      onChange={() => {
                        if (selectedForNewGame.includes(player.id)) {
                          setSelectedForNewGame(prev => prev.filter(id => id !== player.id));
                        } else if (selectedForNewGame.length < 3) {
                          setSelectedForNewGame(prev => [...prev, player.id]);
                        }
                      }}
                    />
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      selectedForNewGame.includes(player.id) ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-300'
                    }`}>
                      {selectedForNewGame.includes(player.id) && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </label>
                ))}
                {players.length < 3 && (
                  <p className="text-center text-sm text-zinc-400 py-4">Necesitas agregar al menos 3 jugadores.</p>
                )}
              </div>

              <div className="p-6 bg-zinc-50 border-t border-zinc-100">
                <button 
                  disabled={selectedForNewGame.length !== 3}
                  onClick={() => {
                    startNewGame(selectedForNewGame);
                    setShowPlayerSelection(false);
                    setSelectedForNewGame([]);
                  }}
                  className="w-full btn-primary py-3"
                >
                  Comenzar Partida
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {selectedPlayerHistory && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayerHistory(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xl font-bold">
                    {selectedPlayerHistory.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{selectedPlayerHistory.name}</h2>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Historial de Derrotas</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPlayerHistory(null)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {history.filter(h => h.playerId === selectedPlayerHistory.id).length === 0 ? (
                  <div className="py-12 text-center text-zinc-400">
                    <History size={32} className="mx-auto mb-2 opacity-20" />
                    <p>Este jugador no tiene derrotas registradas.</p>
                  </div>
                ) : (
                  history
                    .filter(h => h.playerId === selectedPlayerHistory.id)
                    .map(entry => (
                      <div key={entry.id} className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                              entry.lossType === 'foul' ? 'bg-red-100 text-red-600' : 'bg-zinc-200 text-zinc-600'
                            }`}>
                              {entry.lossType === 'foul' ? `FALTA: ${entry.foulType}` : 'POR PUNTOS'}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {new Date(entry.date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Oponentes</p>
                            <p className="text-sm font-medium">{entry.opponents.join(' vs ')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Puntuación Final</p>
                            <div className="flex gap-2">
                              {Object.entries(entry.finalScores).map(([name, score]) => (
                                <div key={name} className="flex flex-col">
                                  <span className="text-[10px] text-zinc-500">{name}</span>
                                  <span className="text-xs font-bold">{score}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
                <div className="text-center">
                  <p className="text-3xl font-black tracking-tighter">{selectedPlayerHistory.losses}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Total Derrotas</p>
                </div>
                <button 
                  onClick={() => setSelectedPlayerHistory(null)}
                  className="btn-primary"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
