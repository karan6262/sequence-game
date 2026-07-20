import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import confetti from 'canvas-confetti';
import { BOARD_LAYOUT } from './constants';

const socket = io.connect(import.meta.env.VITE_SERVER_URL || 'https://sequence-server-g51u.onrender.com');

const AVATARS = ['😎', '🦊', '🦁', '🦄', '👽', '💀', '🤖', '👑'];

const playSound = (type) => {
  const sounds = { play: new Audio(''), remove: new Audio(''), win: new Audio(''), chat: new Audio('') };
  if (sounds[type] && sounds[type].src) sounds[type].play().catch(() => {});
};

export default function SequenceGame() {

  const [avatar, setAvatar] = useState('😎');
  const playerIdRef = useRef(null);

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
    let pid = sessionStorage.getItem('sequence_playerId');
    if (!pid) {
      pid = 'player_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('sequence_playerId', pid);
    }
    playerIdRef.current = pid;

    const handleRoomJoined = (roomId) => {
      setCurrentRoom(roomId);
      setAppState('team_select');
    };

    const handleRoomInfo = (info) => {
      if (info) setRoomInfo(info);
    };

    const handleAssignedTeam = (color) => {
      setMyTeam(color);
      setAppState('game');
    };

    const handleGameState = (gameState) => {
      if (!gameState) return;

      setBoardChips(gameState.board || Array(100).fill(null));
      setCurrentTurn(gameState.turn || 'red');
      setActivePlayerId(gameState.activePlayerId);
      setActivePlayerName(gameState.activePlayerName || 'Waiting...');
      setLogs(gameState.logs || []);
      setIsGameStarted(gameState.isGameStarted || false);
      setWinner(gameState.winner);
      setWinningLine(gameState.winningLine || []);
      setHostId(gameState.hostId);
      setTurnDeadline(gameState.turnDeadline || 0);

      if (gameState.winner && !winner) {
        playSound('win');
        setTimeout(() => {
          confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 }, colors: [gameState.winner === 'red' ? '#f43f5e' : gameState.winner === 'blue' ? '#22d3ee' : '#34d399', '#ffffff'] });
        }, 300);
        setTimeout(() => {
          confetti({ particleCount: 150, spread: 100, origin: { y: 0.4 }, colors: ['#ffffff', '#f97316', '#ec4899'] });
        }, 600);
      }
    };

    const handleReceivePing = ({ index, teamColor }) => {
      if (teamColor === myTeam) {
        setActivePings(prev => ({ ...prev, [index]: true }));
        setTimeout(() => setActivePings(prev => { const n = { ...prev }; delete n[index]; return n; }), 3000);
        if ('vibrate' in navigator) navigator.vibrate(10);
      }
    };

    const handleYourHand = (dealtHand) => setHand(dealtHand || []);
    const handleChatMessage = (msg) => {
      setChats(prev => [...prev, msg]);
      playSound('chat');
      setTimeout(() => {
        const chatContainer = document.querySelector('.chat-scroll-container');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 100);
    };

    const handleGameRestarted = (allHands) => {
      setWinner(null);
      setWinningLine([]);
      setActivePings({});
      if (allHands && allHands[playerIdRef.current]) {
        setHand(allHands[playerIdRef.current]);
        setSelectedCard(null);
      }
      setChats([]);
    };

    const handleErrorMessage = (msg) => {
      alert(msg);
    };

    socket.on('room_joined', handleRoomJoined);
    socket.on('room_info', handleRoomInfo);
    socket.on('assigned_team', handleAssignedTeam);
    socket.on('game_state', handleGameState);
    socket.on('receive_ping', handleReceivePing);
    socket.on('your_hand', handleYourHand);
    socket.on('chat_message', handleChatMessage);
    socket.on('game_restarted', handleGameRestarted);
    socket.on('error_message', handleErrorMessage);

    const savedRoom = sessionStorage.getItem('sequence_room');
    const savedName = sessionStorage.getItem('sequence_name');
    if (savedRoom && savedName) {
      setRoomInput(savedRoom);
      setPlayerName(savedName);
      socket.emit('join_room', { roomId: savedRoom, playerName: savedName, playerId: pid, avatar });
    }

    return () => socket.offAny();
  }, [winner]);

  useEffect(() => {
    if (!turnDeadline || winner || !isGameStarted) {
      setTimeLeft(60);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((turnDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && socket.id === activePlayerId) {
        socket.emit('timeout_skip', { roomId: currentRoom, playerId: playerIdRef.current });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [turnDeadline, winner, isGameStarted, activePlayerId, currentRoom]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomInput.trim() && playerName.trim()) {
      sessionStorage.setItem('sequence_room', roomInput.trim());
      sessionStorage.setItem('sequence_name', playerName.trim());
      socket.emit('join_room', { roomId: roomInput.trim(), playerName: playerName.trim(), playerId: playerIdRef.current, avatar });
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      socket.emit('send_chat', { roomId: currentRoom, playerId: playerIdRef.current, msg: chatInput });
      setChatInput('');
    }
  };

  const handlePing = (e, index) => {
    e.preventDefault();
    if (!isGameStarted || winner) return;
    socket.emit('ping_cell', { roomId: currentRoom, index, teamColor: myTeam });
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  const checkDeadCard = (card) => {
    if (!card || card.includes('J')) return false;
    const indices = BOARD_LAYOUT.map((c, i) => c === card ? i : -1).filter(i => i !== -1);
    return indices.every(i => boardChips[i] !== null);
  };

  const handleCellClick = (index) => {
    if (!isGameStarted || winner || playerIdRef.current !== activePlayerId || !selectedCard || BOARD_LAYOUT[index] === 'FREE') return;

    const targetSpace = BOARD_LAYOUT[index];
    const isTwoEyed = selectedCard === 'J♦' || selectedCard === 'J♣';
    const isOneEyed = selectedCard === 'J♠' || selectedCard === 'J♥';

    if (isTwoEyed && boardChips[index] !== null) return;
    if (isOneEyed && (boardChips[index] === null || boardChips[index] === myTeam)) return;
    if (!isTwoEyed && !isOneEyed && (boardChips[index] !== null || selectedCard !== targetSpace)) return;

    playSound(isOneEyed ? 'remove' : 'play');
    if ('vibrate' in navigator && !selectedCard.includes('J')) navigator.vibrate(15);

    socket.emit('place_chip', { roomId: currentRoom, index, teamColor: myTeam, playedCard: selectedCard, playerId: playerIdRef.current });

    setHand(hand.filter(card => card !== selectedCard));
    setSelectedCard(null);
  };

  const handleDisconnect = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  const t = {
    bg: "bg-gradient-to-br from-pink-400 via-yellow-400 to-orange-400",
    card: "bg-white/90 border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300",
    boardBg: "bg-white/80 border border-gray-300/30",
    freeCell: "bg-yellow-200/50 border border-yellow-400/50",
    regCell: "bg-white/30 border border-gray-200/30",
  };

  const getTeamNeon = (team) =>
    team === 'red' ? 'text-rose-600' : team === 'blue' ? 'text-blue-600' : team === 'green' ? 'text-green-600' : 'text-gray-600';

  const getChipStyle = (color, isWin) => {
    let bg = color === 'red' ? 'bg-gradient-to-br from-rose-400 to-rose-600' : color === 'blue' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-green-400 to-green-600';
    return `${bg} shadow-lg ${isWin ? 'ring-2 ring-white/50' : ''}`;
  };

  if (appState === 'lobby' || appState === 'team_select') return (
    <div className={`min-h-[100dvh] w-full ${t.bg} text-gray-900 flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden font-sans`}>
       <div className="mb-4">
         <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-yellow-400 to-orange-500">
           SEQUENCE
         </h2>
       </div>

       <div className="bg-white/20 backdrop-blur-md p-8 rounded-3xl shadow-2xl w-full max-w-2xl text-center z-10">
          <h1 className="text-5xl font-bold text-gray-800 mb-8">SEQUENCE</h1>

          {appState === 'lobby' ? (
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-4 max-w-md mx-auto">
              <div className="flex justify-center gap-2 mb-4">
                {AVATARS.map(a => (
                  <div key={a} onClick={()=>setAvatar(a)} className={`text-2xl cursor-pointer p-2 rounded-xl transition-all ${avatar===a?'bg-white/20 scale-125':'hover:scale-110'}`}>{a}</div>
                ))}
              </div>
              <input type="text" placeholder="Name" value={playerName} onChange={e=>setPlayerName(e.target.value)} className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-center font-bold text-white" required />
              <input type="text" placeholder="Room Code" value={roomInput} onChange={e=>setRoomInput(e.target.value)} className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-center font-bold uppercase text-white" required />
              <button className="bg-gradient-to-r from-pink-500 via-yellow-500 to-orange-500 text-white font-bold py-4 rounded-xl mt-4 hover:scale-105 transition-transform active:scale-95">JOIN SQUAD</button>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['red','blue','green'].map(color => (
                <div key={color} className="flex flex-col gap-2 border border-white/10 p-4 rounded-2xl bg-black/20">
                  <h3 className={`font-black text-xl uppercase ${getTeamNeon(color)}`}>{color}</h3>
                  <div className="text-sm font-bold opacity-70 mb-4 h-16">{roomInfo[color]?.join(', ') || 'Empty'}</div>
                  <button onClick={() => socket.emit('join_team', {roomId: currentRoom, teamColor: color, playerId: playerIdRef.current})} disabled={roomInfo[color]?.length >= 4} className="bg-white/10 py-2 rounded-lg font-bold hover:bg-white/20 transition-colors text-white transform active:scale-95">
                    JOIN TEAM
                  </button>
                </div>
              ))}
            </div>
          )}
       </div>
    </div>
  );

  const isMyTurn = playerIdRef.current === activePlayerId && isGameStarted && !winner;
  const isDeadCard = selectedCard && checkDeadCard(selectedCard);

  return (
    // On Mobile: Single scrolling page (overflow-y-auto). On Desktop: Fixed screen height (md:h-[100dvh]) with independent columns.
    <div className={`min-h-[100dvh] md:h-[100dvh] overflow-y-auto md:overflow-hidden ${t.bg} text-gray-900 flex flex-col md:flex-row p-2 sm:p-4 gap-4 font-sans relative`}>

      {/* WAITING TO START OVERLAY */}
      {!isGameStarted && !winner && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-start py-12 md:justify-center animate-in fade-in duration-500 overflow-y-auto px-4">
          <h2 className={`text-3xl sm:text-5xl md:text-6xl font-black mb-2 tracking-widest text-center ${getTeamNeon(myTeam)} shrink-0`}>
            {myTeam.toUpperCase()} SQUAD DEPLOYED
          </h2>

          <p className="text-slate-300 mb-8 font-bold tracking-widest text-center shrink-0">
            {playerIdRef.current === hostId ? "You are the Room Host." : "Waiting for Host to start the match..."}<br/>
            Players in Room: {roomInfo.total} / 12
          </p>

          <div className="flex flex-col md:flex-row gap-4 mb-8 w-full max-w-5xl shrink-0">
            {['red', 'blue', 'green'].map(color => (
              <div key={color} className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
                <h3 className={`font-black uppercase text-xl mb-3 ${getTeamNeon(color)}`}>{color} Team</h3>
                <div className="flex-1 w-full flex flex-col gap-2 mb-4">
                  {roomInfo[color]?.length > 0 ? (
                    roomInfo[color].map((player, idx) => (
                      <div key={idx} className="bg-black/40 px-3 py-2 rounded-lg text-sm text-white font-bold w-full text-center truncate shadow-inner">
                        {player}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-sm font-bold text-center italic py-2">Empty</div>
                  )}
                </div>
                
                {playerIdRef.current === hostId && (
                  <div className="w-full flex gap-2">
                    <button onClick={() => socket.emit('add_bot', {roomId: currentRoom, teamColor: color})} disabled={roomInfo[color]?.length >= 4} className="flex-1 bg-white/10 border border-white/20 py-2 rounded-lg font-bold text-xs hover:bg-white/20 transition-colors uppercase text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                      + Add Bot
                    </button>
                    {roomInfo[color]?.some(p => p.includes('🤖 Bot')) && (
                      <button onClick={() => socket.emit('remove_bot', {roomId: currentRoom, teamColor: color})} className="flex-1 bg-rose-500/20 border border-rose-500/40 py-2 rounded-lg font-bold text-xs hover:bg-rose-500/40 transition-colors uppercase text-rose-200 active:scale-95">
                        - Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {playerIdRef.current === hostId && (
            <button onClick={() => socket.emit('start_game', currentRoom)} className="shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black py-4 px-12 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:scale-110 transition-transform text-xl sm:text-2xl active:scale-105">
              START MATCH
            </button>
          )}
        </div>
      )}

      {/* GAME OVER OVERLAY */}
      {winner && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <h1 className={`text-6xl sm:text-8xl font-black mb-10 tracking-[0.2em] ${getTeamNeon(winner)}`}>{winner.toUpperCase()} WINS</h1>
          <div className="flex gap-6">
            <button onClick={() => socket.emit('restart_game', currentRoom)} className="bg-white text-black font-black py-4 px-8 rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]">PLAY AGAIN</button>
            <button onClick={handleDisconnect} className="bg-transparent border border-white/20 text-white font-bold py-4 px-8 rounded-xl hover:bg-white/10 transition-all">LEAVE ROOM</button>
          </div>
        </div>
      )}

      {/* LEFT COLUMN: Game Board & Hand - Scrolls independently on desktop */}
      <div className="flex-1 flex flex-col items-center justify-start w-full relative z-10 md:h-full md:overflow-y-auto md:pr-4 pb-12 shrink-0 scroll-smooth">
        
        {/* Desktop Title Bar */}
        <div className="w-full flex justify-between bg-black/40 border border-white/10 p-2 sm:p-3 rounded-xl sm:rounded-2xl mt-2 mb-4 shadow-sm backdrop-blur-md shrink-0">
           <div className={`font-black tracking-widest text-xs sm:text-base ${isGameStarted ? getTeamNeon(currentTurn) : 'text-slate-500'}`}>
             {winner ? 'MATCH COMPLETE' : isGameStarted ? `${activePlayerName}'S TURN` : 'STANDBY...'}
           </div>
           <div className="font-bold text-xs sm:text-base text-gray-300">THEME: PLAYFUL</div>
        </div>

        {/* Board Container */}
        <div className={`w-full max-w-[95vw] md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto p-1 sm:p-2 rounded-xl sm:rounded-[2rem] border transition-all shrink-0 ${t.boardBg}`}>
          <div className="grid grid-cols-10 gap-[2px] sm:gap-1 w-full">
            {BOARD_LAYOUT.map((card, idx) => {
              const chip = boardChips[idx];
              const isWinChip = winningLine.includes(idx);
              const isPung = activePings[idx];
              const isMatch = isMyTurn && selectedCard && ((card === selectedCard && !chip) || (selectedCard.includes('J') && ((selectedCard.includes('♦')||selectedCard.includes('♣'))?!chip:chip&&chip!==myTeam)));

              return (
                <div key={idx} onClick={() => handleCellClick(idx)} onContextMenu={(e) => handlePing(e, idx)}
                     className={`relative aspect-[3/4] rounded flex items-center justify-center ${card==='FREE'?t.freeCell:t.regCell} ${isMatch?'ring-2 sm:ring-4 ring-white z-10 scale-110 cursor-pointer shadow-xl':''} ${winner && !isWinChip ? 'opacity-30' : ''} ${isPung ? 'ring-2 ring-rose-500 animate-pulse' : ''}`}>

                  {isPung && <div className="absolute inset-0 bg-rose-500/40 rounded animate-ping pointer-events-none"></div>}

                  {card!=='FREE' && <span className={`font-black text-[10px] sm:text-xs md:text-sm ${card.includes('♥')||card.includes('♦')?'text-red-600':'text-black'}`}>{card}</span>}
                  {chip && <div className={`absolute w-[70%] h-[70%] rounded-full ${getChipStyle(chip, isWinChip)}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Player Hand Container */}
        <div className="w-full mt-4 sm:mt-8 flex flex-col items-center shrink-0">
          <p className="text-[10px] sm:text-xs font-bold opacity-50 mb-2 sm:mb-4 tracking-widest text-center">RIGHT CLICK BOARD TO PING TEAMMATES</p>
          {!winner && (
            <>
              <div className="flex -space-x-3 sm:-space-x-4">
                {(hand || []).map((card, i) => (
                  <div key={i} onClick={() => isMyTurn && setSelectedCard(card)} className={`relative w-12 h-16 sm:w-16 sm:h-24 md:w-20 md:h-28 ${t.card} rounded-md sm:rounded-lg flex items-center justify-center origin-bottom transition-all ${selectedCard===card?'ring-2 sm:ring-4 ring-white -translate-y-4 sm:-translate-y-6 scale-110 z-20':'z-0'} ${isMyTurn?'cursor-pointer hover:-translate-y-2 sm:hover:-translate-y-4':'opacity-50'}`}>
                    <span className={`font-black text-base sm:text-xl md:text-2xl ${card.includes('♥')||card.includes('♦')?'text-red-600':'text-black'}`}>{card}</span>
                  </div>
                ))}
              </div>
              {isMyTurn && isDeadCard && (
                <button onClick={() => {socket.emit('trade_dead_card', {roomId: currentRoom, playerId: playerIdRef.current, deadCard: selectedCard}); setSelectedCard(null)}} className="mt-6 bg-rose-600 px-6 py-2 rounded-full font-bold animate-bounce shadow-lg shadow-rose-500/50 text-white">TRADE DEAD CARD</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Social Panel - Pinned to right side on desktop */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col gap-4 min-h-[300px] md:h-full relative z-10 shrink-0">
        <div className="bg-black/40 border border-white/10 rounded-2xl flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10 font-bold tracking-widest text-xs opacity-70 text-white">COMMUNICATIONS</div>
          <div className="chat-scroll-container flex-1 p-3 overflow-y-auto flex flex-col gap-2 text-sm">
            {chats.map((c, i) => (
              <div key={i} className={`p-2 rounded-lg max-w-[90%] text-white ${c.name === playerName ? 'bg-white/20 self-end' : 'bg-black/40 self-start border-l-2'} ${c.team==='red'?'border-rose-500':c.team==='blue'?'border-cyan-500':'border-emerald-500'}`}>
                <span className="font-bold text-xs opacity-50 block mb-1">{c.name}</span>
                {c.msg}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="p-2 border-t border-white/10 flex gap-2 bg-black/60">
            <input type="text" value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Send message..." className="flex-1 bg-transparent focus:outline-none text-sm px-2 text-white"/>
            <button type="submit" className="bg-white/20 text-white px-3 py-1 rounded-md text-xs font-bold active:scale-95">SEND</button>
          </form>
        </div>

        <div className="h-48 bg-black/40 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10 font-bold tracking-widest text-xs opacity-70 text-white">ACTION LOG</div>
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-1 text-xs opacity-80 text-white">
            {logs.map((log, i) => <div key={i} className="border-b border-white/5 pb-1">⚡ {log}</div>)}
          </div>
        </div>
      </div>

    </div>
  );
}
