import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import confetti from 'canvas-confetti';
import { BOARD_LAYOUT } from './constants';

const socket = io.connect(import.meta.env.VITE_SERVER_URL || 'https://sequence-server-g51u.onrender.com');

const AVATARS = ['😎', '🦊', '🦁', '🦄', '👽', '💀', '🤖', '👑'];

const playSound = (type) => {
  const sounds = { play: new Audio(''), remove: new Audio(''), win: new Audio(''), chat: new Audio('') };
  if (sounds[type] && sounds[type].src) sounds[type].play().catch(() => {});
};

const getSessionPlayerId = () => {
  let pid = sessionStorage.getItem('sequence_playerId');
  if (!pid) { pid = 'player_' + Math.random().toString(36).substr(2, 9); sessionStorage.setItem('sequence_playerId', pid); }
  return pid;
};

export default function SequenceGame() {
  const [playerId] = useState(getSessionPlayerId());
  
  const [theme, setTheme] = useState(localStorage.getItem('seq_theme') || 'cyber');
  const [avatar, setAvatar] = useState('😎');
  
  const [appState, setAppState] = useState('lobby');
  const [roomInput, setRoomInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomInfo, setRoomInfo] = useState({ red: [], blue: [], green: [], unassigned: [], total: 0 });

  const [boardChips, setBoardChips] = useState(Array(100).fill(null));
  const [currentTurn, setCurrentTurn] = useState('red');
  const [winner, setWinner] = useState(null);
  const [winningLine, setWinningLine] = useState([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [activePlayerName, setActivePlayerName] = useState('Waiting...');
  const [timeLeft, setTimeLeft] = useState(60);

  const [hostId, setHostId] = useState(null);
  const [turnDeadline, setTurnDeadline] = useState(0); 

  const [myTeam, setMyTeam] = useState('');
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  
  const [logs, setLogs] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chats, setChats] = useState([]);
  const [activePings, setActivePings] = useState({});

  useEffect(() => {
    localStorage.setItem('seq_theme', theme);
  }, [theme]);

  useEffect(() => {
    const savedRoom = sessionStorage.getItem('sequence_room');
    const savedName = sessionStorage.getItem('sequence_name');
    if (savedRoom && savedName) {
      setRoomInput(savedRoom); setPlayerName(savedName);
      socket.emit('join_room', { roomId: savedRoom, playerName: savedName, playerId, avatar });
    }
  }, [playerId]);

  useEffect(() => {
    socket.on('room_joined', (roomId) => { setCurrentRoom(roomId); setAppState('team_select'); });
    socket.on('room_info', (info) => { if(info) setRoomInfo(info); });
    socket.on('assigned_team', (color) => { setMyTeam(color); setAppState('game'); });
    
    socket.on('game_state', (gameState) => {
      if(!gameState) return;
      setBoardChips(gameState.board || Array(100).fill(null));
      setCurrentTurn(gameState.turn || 'red');
      setActivePlayerId(gameState.activePlayerId);
      setActivePlayerName(gameState.activePlayerName || 'Waiting...');
      setLogs(gameState.logs || []);
      setIsGameStarted(gameState.isGameStarted || false);
      setWinner(gameState.winner);
      setWinningLine(gameState.winningLine || []);
      setHostId(gameState.hostId);
      setTurnDeadline(gameState.turnDeadline);

      if (gameState.winner && !winner) {
        playSound('win');
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: [gameState.winner === 'red' ? '#f43f5e' : gameState.winner === 'blue' ? '#22d3ee' : '#34d399', '#ffffff'] });
      }
    });

    socket.on('receive_ping', ({ index, teamColor }) => {
      if (teamColor === myTeam) {
        setActivePings(prev => ({ ...prev, [index]: true }));
        setTimeout(() => setActivePings(prev => { const n = {...prev}; delete n[index]; return n; }), 3000);
      }
    });
    
    socket.on('your_hand', (dealtHand) => setHand(dealtHand || []));
    socket.on('chat_message', (msg) => { setChats(prev => [...prev, msg]); playSound('chat'); });
    
    socket.on('game_restarted', (allHands) => {
      setWinner(null); setWinningLine([]); setActivePings({});
      if (allHands && allHands[playerId]) { setHand(allHands[playerId]); setSelectedCard(null); }
      setChats([]);
    });

    socket.on('error_message', alert);
    return () => socket.offAny();
  }, [playerId, myTeam, winner]);

  useEffect(() => {
    if (!turnDeadline || winner || !isGameStarted) {
      setTimeLeft(60);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((turnDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && socket.id === activePlayerId) {
        socket.emit('timeout_skip', { roomId: currentRoom, playerId });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [turnDeadline, winner, isGameStarted, activePlayerId, currentRoom, playerId]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomInput.trim() && playerName.trim()) {
      sessionStorage.setItem('sequence_room', roomInput.trim());
      sessionStorage.setItem('sequence_name', playerName.trim());
      socket.emit('join_room', { roomId: roomInput.trim(), playerName: playerName.trim(), playerId, avatar });
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      socket.emit('send_chat', { roomId: currentRoom, playerId, msg: chatInput });
      setChatInput('');
    }
  };

  const handlePing = (e, index) => {
    e.preventDefault();
    if (!isGameStarted || winner) return;
    socket.emit('ping_cell', { roomId: currentRoom, index, teamColor: myTeam });
  };

  const checkDeadCard = (card) => {
    if (!card || card.includes('J')) return false;
    const indices = BOARD_LAYOUT.map((c, i) => c === card ? i : -1).filter(i => i !== -1);
    return indices.every(i => boardChips[i] !== null);
  };

  const handleCellClick = (index) => {
    if (!isGameStarted || winner || playerId !== activePlayerId || !selectedCard || BOARD_LAYOUT[index] === 'FREE') return;
    
    const targetSpace = BOARD_LAYOUT[index];
    const isTwoEyed = selectedCard === 'J♦' || selectedCard === 'J♣';
    const isOneEyed = selectedCard === 'J♠' || selectedCard === 'J♥';

    if (isTwoEyed && boardChips[index] !== null) return;
    if (isOneEyed && (boardChips[index] === null || boardChips[index] === myTeam)) return;
    if (!isTwoEyed && !isOneEyed && (boardChips[index] !== null || selectedCard !== targetSpace)) return;

    playSound(isOneEyed ? 'remove' : 'play');
    socket.emit('place_chip', { roomId: currentRoom, index, teamColor: myTeam, playedCard: selectedCard, playerId });
    setHand(hand.filter(card => card !== selectedCard));
    setSelectedCard(null);
  };

  const handleDisconnect = () => { sessionStorage.clear(); window.location.reload(); };

  // THEME ENGINE
  const t = {
    bg: theme === 'cyber' ? "bg-[#0a0f1a] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" : "bg-[#2d1b11] bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]",
    card: theme === 'cyber' ? "bg-slate-200 shadow-xl" : "bg-[#f5deb3] shadow-[2px_2px_5px_rgba(0,0,0,0.5)] border-[#8b4513]",
    boardBg: theme === 'cyber' ? "bg-white/[0.05] border-white/30" : "bg-[#5c3a21] border-[#3e2723] shadow-inner",
    freeCell: theme === 'cyber' ? "bg-amber-400" : "bg-yellow-600 border border-yellow-800",
    regCell: theme === 'cyber' ? "bg-slate-200" : "bg-[#e8d5b5] border border-[#a0522d]",
  };

  const getTeamNeon = (team) => team === 'red' ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]' : team === 'blue' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : team === 'green' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'text-slate-400';
  
  const getChipStyle = (color, isWin) => {
    const cyberColors = color === 'red' ? 'from-rose-400 to-rose-900 ring-rose-300' : color === 'blue' ? 'from-cyan-400 to-cyan-900 ring-cyan-300' : 'from-emerald-400 to-emerald-900 ring-emerald-300';
    const woodColors = color === 'red' ? 'from-red-600 to-red-800 ring-red-900' : color === 'blue' ? 'from-blue-600 to-blue-800 ring-blue-900' : 'from-green-600 to-green-800 ring-green-900';
    const base = theme === 'cyber' ? cyberColors : woodColors;
    
    return `bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] ${base} shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] ring-1 ${isWin ? 'animate-bounce ring-4 shadow-[0_0_30px_rgba(255,255,255,1)] brightness-150' : ''}`;
  };

  const layoutContainer = `min-h-[100dvh] w-full ${t.bg} text-white flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden font-sans`;

  if (appState === 'lobby' || appState === 'team_select') return (
    <div className={layoutContainer}>
       <div className="absolute top-4 right-4 flex gap-2">
         <button onClick={()=>setTheme('cyber')} className={`px-4 py-1 rounded font-bold ${theme==='cyber'?'bg-cyan-500 text-black':'bg-black/50 text-white'}`}>CYBER</button>
         <button onClick={()=>setTheme('wood')} className={`px-4 py-1 rounded font-bold ${theme==='wood'?'bg-[#8b4513] text-white':'bg-black/50 text-white'}`}>WOOD</button>
       </div>

       <div className={`backdrop-blur-2xl ${theme==='cyber'?'bg-white/[0.02] border-white/10':'bg-[#3e2723]/90 border-[#5c3a21]'} p-8 rounded-3xl shadow-2xl w-full max-w-2xl text-center z-10`}>
          <h1 className={`text-5xl font-black mb-8 tracking-[0.2em] ${theme==='cyber'?'text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-cyan-400':'text-[#f5deb3] drop-shadow-md'}`}>SEQUENCE</h1>
          
          {appState === 'lobby' ? (
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-4 max-w-md mx-auto">
              <div className="flex justify-center gap-2 mb-4">
                {AVATARS.map(a => (
                  <div key={a} onClick={()=>setAvatar(a)} className={`text-2xl cursor-pointer p-2 rounded-xl transition-all ${avatar===a?'bg-white/20 scale-125':'hover:scale-110'}`}>{a}</div>
                ))}
              </div>
              <input type="text" placeholder="Name" value={playerName} onChange={e=>setPlayerName(e.target.value)} className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-center font-bold text-white" required />
              <input type="text" placeholder="Room Code" value={roomInput} onChange={e=>setRoomInput(e.target.value)} className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-center font-bold uppercase text-white" required />
              <button className={`font-black py-4 rounded-xl mt-4 hover:scale-105 transition-transform ${theme==='cyber'?'bg-white text-black':'bg-[#f5deb3] text-[#3e2723]'}`}>JOIN SQUAD</button>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['red','blue','green'].map(color => (
                <div key={color} className="flex flex-col gap-2 border border-white/10 p-4 rounded-2xl bg-black/20">
                  <h3 className={`font-black text-xl uppercase ${getTeamNeon(color)}`}>{color}</h3>
                  <div className="text-sm font-bold opacity-70 mb-4 h-16">{roomInfo[color]?.join(', ') || 'Empty'}</div>
                  <button onClick={() => socket.emit('join_team', {roomId: currentRoom, teamColor: color, playerId})} disabled={roomInfo[color]?.length >= 4} className="bg-white/10 py-2 rounded-lg font-bold hover:bg-white/20 transition-colors">JOIN TEAM</button>
                  <button onClick={() => socket.emit('add_bot', {roomId: currentRoom, teamColor: color})} disabled={roomInfo[color]?.length >= 4} className="bg-white/5 py-2 rounded-lg font-bold text-xs hover:bg-white/10 transition-colors">🤖 ADD BOT</button>
                </div>
              ))}
            </div>
          )}
       </div>
    </div>
  );

  // Define logic booleans *after* team select check to prevent undefined errors
  const isMyTurn = playerId === activePlayerId && isGameStarted && !winner;
  const isDeadCard = selectedCard && checkDeadCard(selectedCard);

  return (
    <div className={`min-h-[100dvh] ${t.bg} text-white flex flex-col md:flex-row p-2 sm:p-4 gap-4 overflow-hidden font-sans relative`}>
      
      {/* WAITING TO START OVERLAY (Prioritized below winner) */}
      {!isGameStarted && !winner && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-500">
          <h2 className={`text-4xl sm:text-6xl font-black mb-4 tracking-widest text-center ${getTeamNeon(myTeam)}`}>
            {myTeam.toUpperCase()} SQUAD DEPLOYED
          </h2>

          {playerId === hostId ? (
            <>
              <p className="text-slate-300 mb-8 font-bold tracking-widest text-center">
                You are the Room Host.<br/> Players: {roomInfo.total}
              </p>
              
              <div className="flex gap-4 mb-8">
                {['red', 'blue', 'green'].map(color => (
                  <button key={color} onClick={() => socket.emit('add_bot', {roomId: currentRoom, teamColor: color})} disabled={roomInfo[color]?.length >= 4} className="border border-white/20 px-4 py-2 rounded-lg font-bold text-xs hover:bg-white/10 transition-colors uppercase bg-black/40">
                    + Add Bot to {color}
                  </button>
                ))}
              </div>

              <button onClick={() => socket.emit('start_game', currentRoom)} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black py-4 px-12 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:scale-110 transition-transform text-2xl">
                START MATCH
              </button>
            </>
          ) : (
            <p className="text-slate-300 mb-8 text-xl font-bold tracking-widest animate-pulse">
              Waiting for Host to configure and start the match...
            </p>
          )}
        </div>
      )}

      {/* GAME OVER OVERLAY (HIGHEST PRIORITY Z-50) */}
      {winner && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <h1 className={`text-6xl sm:text-8xl font-black mb-10 tracking-[0.2em] ${getTeamNeon(winner)}`}>{winner.toUpperCase()} WINS</h1>
          <div className="flex gap-6">
            <button onClick={() => socket.emit('restart_game', currentRoom)} className="bg-white text-black font-black py-4 px-8 rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]">PLAY AGAIN</button>
            <button onClick={handleDisconnect} className="bg-transparent border border-white/20 text-white font-bold py-4 px-8 rounded-xl hover:bg-white/10 transition-all">LEAVE ROOM</button>
          </div>
        </div>
      )}

      {/* LEFT: Game Board */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full relative z-10">
        <div className="w-full flex justify-between bg-black/40 border border-white/10 p-3 rounded-2xl mb-4 shadow-lg backdrop-blur-md">
           <div className={`font-black tracking-widest ${isGameStarted ? getTeamNeon(currentTurn) : 'text-slate-500'}`}>
             {winner ? 'MATCH COMPLETE' : isGameStarted ? `${activePlayerName}'S TURN` : 'STANDBY...'}
           </div>
           <div className={`font-bold ${theme==='cyber'?'text-white':'text-[#f5deb3]'}`}>THEME: {theme.toUpperCase()}</div>
        </div>

        <div className={`w-full p-2 rounded-[2rem] border transition-all ${t.boardBg}`}>
          <div className="grid grid-cols-10 gap-0.5 sm:gap-1 w-full">
            {BOARD_LAYOUT.map((card, idx) => {
              const chip = boardChips[idx];
              const isWinChip = winningLine.includes(idx);
              const isPung = activePings[idx];
              const isMatch = isMyTurn && selectedCard && ((card === selectedCard && !chip) || (selectedCard.includes('J') && ((selectedCard.includes('♦')||selectedCard.includes('♣'))?!chip:chip&&chip!==myTeam)));
              
              return (
                <div key={idx} onClick={() => handleCellClick(idx)} onContextMenu={(e) => handlePing(e, idx)} 
                     className={`relative aspect-[3/4] rounded flex items-center justify-center ${card==='FREE'?t.freeCell:t.regCell} ${isMatch?'ring-4 ring-white z-10 scale-110 cursor-pointer':''} ${winner && !isWinChip ? 'opacity-30' : ''} ${isPung ? 'ring-4 ring-rose-500 animate-pulse' : ''}`}>
                  
                  {isPung && <div className="absolute inset-0 bg-rose-500/40 rounded animate-ping pointer-events-none"></div>}

                  {card!=='FREE' && <span className={`font-black text-[9px] sm:text-xs md:text-sm ${card.includes('♥')||card.includes('♦')?'text-red-600':'text-black'}`}>{card}</span>}
                  {chip && <div className={`absolute w-[70%] h-[70%] rounded-full ${getChipStyle(chip, isWinChip)}`} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full mt-6 flex flex-col items-center">
          <p className="text-xs font-bold opacity-50 mb-4 tracking-widest">RIGHT CLICK BOARD TO PING TEAMMATES</p>
          {/* Gate the hand/dead card trading so they don't render after a win */}
          {!winner && (
            <>
              <div className="flex -space-x-4">
                {(hand || []).map((card, i) => (
                  <div key={i} onClick={() => isMyTurn && setSelectedCard(card)} className={`relative w-16 h-24 sm:w-20 sm:h-28 ${t.card} rounded-lg flex items-center justify-center origin-bottom transition-all ${selectedCard===card?'ring-4 ring-white -translate-y-6 scale-110 z-20':'z-0'} ${isMyTurn?'cursor-pointer hover:-translate-y-4':'opacity-50'}`}>
                    <span className={`font-black text-xl sm:text-2xl ${card.includes('♥')||card.includes('♦')?'text-red-600':'text-black'}`}>{card}</span>
                  </div>
                ))}
              </div>
              {isMyTurn && isDeadCard && (
                <button onClick={() => {socket.emit('trade_dead_card', {roomId: currentRoom, playerId, deadCard: selectedCard}); setSelectedCard(null)}} className="mt-4 bg-rose-600 px-6 py-2 rounded-full font-bold animate-bounce shadow-lg shadow-rose-500/50">TRADE DEAD CARD</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT: Social Panel */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col gap-4 max-h-[100dvh] relative z-10">
        <div className="bg-black/40 border border-white/10 rounded-2xl flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10 font-bold tracking-widest text-xs opacity-70">COMMUNICATIONS</div>
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 text-sm">
            {chats.map((c, i) => (
              <div key={i} className={`p-2 rounded-lg max-w-[90%] ${c.name === playerName ? 'bg-white/20 self-end' : 'bg-black/40 self-start border-l-2'} ${c.team==='red'?'border-rose-500':c.team==='blue'?'border-cyan-500':'border-emerald-500'}`}>
                <span className="font-bold text-xs opacity-50 block mb-1">{c.name}</span>
                {c.msg}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="p-2 border-t border-white/10 flex gap-2 bg-black/60">
            <input type="text" value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Send message..." className="flex-1 bg-transparent focus:outline-none text-sm px-2 text-white"/>
            <button type="submit" className="bg-white/20 px-3 py-1 rounded-md text-xs font-bold">SEND</button>
          </form>
        </div>

        <div className="h-48 bg-black/40 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10 font-bold tracking-widest text-xs opacity-70">ACTION LOG</div>
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-1 text-xs opacity-80">
            {logs.map((log, i) => <div key={i} className="border-b border-white/5 pb-1">⚡ {log}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
