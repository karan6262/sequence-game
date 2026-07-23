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

const chipAnimationStyles = `
  @keyframes chipDrop {
    0% { transform: scale(2) translateY(-20px); opacity: 0; box-shadow: 0 20px 20px rgba(0,0,0,0.6); }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  .chip-drop {
    animation: chipDrop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
  @keyframes drawLine {
    from { stroke-dashoffset: 100; }
    to { stroke-dashoffset: 0; }
  }
  .winning-line {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: drawLine 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
  @keyframes floatUpFade {
    0% { opacity: 0; transform: translateY(10px) scale(0.8); }
    20% { opacity: 1; transform: translateY(-5px) scale(1.2); }
    80% { opacity: 1; transform: translateY(-15px) scale(1); }
    100% { opacity: 0; transform: translateY(-25px) scale(0.8); }
  }
  .emote-float {
    animation: floatUpFade 2.5s ease-out forwards;
  }
  @keyframes slideDownDraw {
    from { transform: translateY(-30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .card-draw {
    animation: slideDownDraw 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
`;

const CardVisual = ({ card }) => {
  if (card === 'FREE') {
    return (
      <div className="absolute inset-0 w-full h-full bg-[#f8f9fa] flex items-center justify-center rounded-[3px] sm:rounded-md border border-gray-400 shadow-sm overflow-hidden">
        <div className="w-[85%] aspect-square rounded-full bg-[#e65c00] flex items-center justify-center shadow-[inset_0_-3px_5px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.3)] border-[1px] border-[#ff7a29]">
           <span className="text-white font-black text-[4.5px] sm:text-[6.5px] md:text-[8px] lg:text-[10px] tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)] rotate-[-40deg] select-none">
             SEQUENCE
           </span>
        </div>
      </div>
    );
  }

  const value = card.slice(0, -1);
  const suit = card.slice(-1);
  const suitMap = { '♠': 'S', '♣': 'C', '♥': 'H', '♦': 'D' };
  
  const apiValue = value === '10' ? '0' : value;
  const imageUrl = `https://deckofcardsapi.com/static/img/${apiValue}${suitMap[suit]}.png`;

  return (
    <div className="absolute inset-0 w-full h-full bg-white rounded-[3px] sm:rounded-md border border-gray-300 shadow-sm overflow-hidden">
      <img 
        src={imageUrl} 
        alt={card} 
        className="w-full h-full object-fill pointer-events-none" 
        loading="lazy"
      />
    </div>
  );
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
  const [lastMoveIndex, setLastMoveIndex] = useState(null);

  const [myTeam, setMyTeam] = useState('');
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  const [logs, setLogs] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chats, setChats] = useState([]);
  const [activePings, setActivePings] = useState({});
  const [showRules, setShowRules] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState({});

  useEffect(() => {
    let pid = sessionStorage.getItem('sequence_playerId');
    if (!pid) {
      pid = 'player_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('sequence_playerId', pid);
    }
    playerIdRef.current = pid;

    const handleConnect = () => {
      const savedRoom = sessionStorage.getItem('sequence_room');
      const savedName = sessionStorage.getItem('sequence_name');
      if (savedRoom && savedName) {
        socket.emit('join_room', { roomId: savedRoom, playerName: savedName, playerId: playerIdRef.current, avatar });
      }
    };

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
      setLastMoveIndex(gameState.lastMoveIndex);

      if (gameState.winner && !winner) {
        playSound('win');
        setTimeout(() => {
          confetti({ particleCount: 250, spread: 150, origin: { y: 0.6 }, colors: [gameState.winner === 'red' ? '#ef4444' : gameState.winner === 'blue' ? '#3b82f6' : '#22c55e', '#ffffff'] });
        }, 200);
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

    const handleReceiveEmote = ({ name, emote }) => {
      const emoteKey = `${emote}-${Date.now()}`; 
      setActiveEmotes(prev => ({ ...prev, [name]: emoteKey }));
      setTimeout(() => {
        setActiveEmotes(prev => {
          const newState = { ...prev };
          if (newState[name] === emoteKey) delete newState[name];
          return newState;
        });
      }, 2500);
    };

    const handleGameRestarted = (allHands) => {
      setWinner(null);
      setWinningLine([]);
      setActivePings({});
      setLastMoveIndex(null);
      if (allHands && allHands[playerIdRef.current]) {
        setHand(allHands[playerIdRef.current]);
        setSelectedCard(null);
      }
      setChats([]);
    };

    const handleErrorMessage = (msg) => {
      alert(msg);
    };

    socket.on('connect', handleConnect);
    socket.on('room_joined', handleRoomJoined);
    socket.on('room_info', handleRoomInfo);
    socket.on('assigned_team', handleAssignedTeam);
    socket.on('game_state', handleGameState);
    socket.on('receive_ping', handleReceivePing);
    socket.on('your_hand', handleYourHand);
    socket.on('chat_message', handleChatMessage);
    socket.on('receive_emote', handleReceiveEmote);
    socket.on('game_restarted', handleGameRestarted);
    socket.on('error_message', handleErrorMessage);

    handleConnect();

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
      if (remaining === 0) {
        socket.emit('timeout_skip', { roomId: currentRoom });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [turnDeadline, winner, isGameStarted, currentRoom]);

  useEffect(() => {
    let titleInterval;
    const isMyTurn = playerIdRef.current === activePlayerId && isGameStarted && !winner;
    
    if (isMyTurn) {
      titleInterval = setInterval(() => {
        document.title = document.title === 'SEQUENCE' ? '🔴 YOUR TURN!' : 'SEQUENCE';
      }, 1000);
    } else {
      document.title = 'SEQUENCE';
    }

    return () => {
      clearInterval(titleInterval);
      document.title = 'SEQUENCE';
    };
  }, [activePlayerId, isGameStarted, winner]);

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

  const handleSendEmote = (emote) => {
    if (!isGameStarted) return;
    const fullPlayerName = `${avatar} ${playerName}`;
    socket.emit('send_emote', { roomId: currentRoom, name: fullPlayerName, emote });
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

  const getValidIndices = () => {
    if (!selectedCard) return [];
    const isTwoEyed = selectedCard === 'J♦' || selectedCard === 'J♣';
    const isOneEyed = selectedCard === 'J♠' || selectedCard === 'J♥';
    
    if (isTwoEyed) {
      return boardChips.map((c, i) => c === null && BOARD_LAYOUT[i] !== 'FREE' ? i : -1).filter(i => i !== -1);
    } else if (isOneEyed) {
      return boardChips.map((c, i) => c !== null && c !== myTeam && BOARD_LAYOUT[i] !== 'FREE' ? i : -1).filter(i => i !== -1);
    } else {
      return BOARD_LAYOUT.map((val, idx) => val === selectedCard && boardChips[idx] === null ? idx : -1).filter(i => i !== -1);
    }
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

  const t = { bg: "bg-gradient-to-br from-[#0f5c6e] via-[#1a7f92] to-[#1292a8]" };

  const getTeamNeon = (team) =>
    team === 'red' ? 'text-red-400' : team === 'blue' ? 'text-blue-400' : team === 'green' ? 'text-green-400' : 'text-gray-300';

  const getChipStyle = (color, isWin, isLast) => {
    let bg = color === 'red' ? 'bg-[#cc2929] border border-[#7a1818]' 
           : color === 'blue' ? 'bg-[#2563eb] border border-[#173d8f]' 
           : 'bg-[#16a34a] border border-[#0f6b30]';
           
    let highlight = isLast && !isWin ? 'ring-[3px] ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.8)] z-30 chip-drop' : '';
    let winGlow = isWin ? 'ring-4 ring-white animate-pulse shadow-[0_0_20px_rgba(255,255,255,1)] z-30' : '';
    
    return `${bg} shadow-[2px_3px_5px_rgba(0,0,0,0.4)] ${highlight} ${winGlow}`;
  };

  if (appState === 'lobby' || appState === 'team_select') return (
    <div className={`min-h-[100dvh] w-full ${t.bg} text-white flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden font-sans`}>
       <div className="mb-4">
         <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300 tracking-[0.2em]">SEQUENCE</h2>
       </div>

       <div className="bg-black/30 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl w-full max-w-2xl text-center z-10 flex flex-col items-center">
          <h1 className="text-5xl font-bold text-white mb-8 tracking-[0.2em]">SEQUENCE</h1>

          {appState === 'lobby' ? (
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-4 w-full max-w-md mx-auto">
              <div className="flex justify-center gap-2 mb-4">
                {AVATARS.map(a => (
                  <div key={a} onClick={()=>setAvatar(a)} className={`text-2xl cursor-pointer p-2 rounded-xl transition-all ${avatar===a?'bg-white/20 scale-125':'hover:scale-110'}`}>{a}</div>
                ))}
              </div>
              <input type="text" placeholder="Name" value={playerName} onChange={e=>setPlayerName(e.target.value)} className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-center font-bold text-white" required />
              <input type="text" placeholder="Room Code" value={roomInput} onChange={e=>setRoomInput(e.target.value)} className="w-full p-4 bg-black/50 border border-white/10 rounded-xl text-center font-bold uppercase text-white" required />
              <button className="bg-white text-black font-black py-4 rounded-xl mt-4 hover:scale-105 transition-transform active:scale-95">JOIN SQUAD</button>
            </form>
          ) : (
            <div className="w-full flex flex-col items-center">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {['red','blue','green'].map(color => (
                  <div key={color} className="flex flex-col gap-2 border border-white/10 p-4 rounded-2xl bg-black/40">
                    <h3 className={`font-black text-xl uppercase ${getTeamNeon(color)}`}>{color}</h3>
                    <div className="text-sm font-bold opacity-70 mb-4 h-16">{roomInfo[color]?.join(', ') || 'Empty'}</div>
                    <button onClick={() => socket.emit('join_team', {roomId: currentRoom, teamColor: color, playerId: playerIdRef.current})} disabled={roomInfo[color]?.length >= 4} className="bg-white/20 py-2 rounded-lg font-bold hover:bg-white/30 transition-colors text-white transform active:scale-95">
                      JOIN TEAM
                    </button>
                  </div>
                ))}
              </div>
              
              <button onClick={handleDisconnect} className="mt-8 bg-transparent border border-white/20 text-white/70 hover:text-white hover:bg-white/10 px-6 py-2 rounded-lg font-bold text-xs tracking-widest transition-all">
                🚪 LEAVE ROOM
              </button>
            </div>
          )}
       </div>
    </div>
  );

  const isMyTurn = playerIdRef.current === activePlayerId && isGameStarted && !winner;
  const isDeadCard = selectedCard && checkDeadCard(selectedCard);
  const strokeColor = winner === 'red' ? '#ef4444' : winner === 'blue' ? '#3b82f6' : '#22c55e';
  const validSpaces = getValidIndices();

  return (
    <div className={`min-h-[100dvh] md:h-[100dvh] overflow-y-auto md:overflow-hidden ${t.bg} text-white flex flex-col md:flex-row p-2 sm:p-4 gap-4 font-sans relative`}>
      <style>{chipAnimationStyles}</style>

      {showRules && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-gradient-to-br from-slate-900 to-black border border-white/20 p-6 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full relative pointer-events-auto">
              <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-white/50 hover:text-white text-2xl transition-colors">&times;</button>
              <h2 className="text-2xl font-black mb-6 tracking-widest text-cyan-400">QUICK RULES</h2>
              <ul className="space-y-4 text-sm text-slate-300">
                <li><strong className="text-white tracking-widest">OBJECTIVE:</strong> Get 5 chips in a row (horizontally, vertically, or diagonally) to win.</li>
                <li><strong className="text-amber-400 tracking-widest">FREE SPACES:</strong> The 4 orange corner spaces act as wild chips for everyone.</li>
                <li><strong className="text-blue-400 tracking-widest">TWO-EYED JACKS:</strong> <span className="text-white">J♦ & J♣</span> are WILD. They let you place a chip on ANY open space.</li>
                <li><strong className="text-rose-400 tracking-widest">ONE-EYED JACKS:</strong> <span className="text-white">J♠ & J♥</span> are KILL cards. They let you REMOVE an opponent's chip.</li>
                <li><strong className="text-white tracking-widest">DEAD CARDS:</strong> If a card in your hand has no open matching spaces left on the board, click "TRADE DEAD CARD" on your turn to swap it.</li>
              </ul>
              <button onClick={() => setShowRules(false)} className="mt-8 w-full bg-white/10 py-3 rounded-xl font-bold hover:bg-white/20 transition-all text-white tracking-widest active:scale-95 border border-white/10">GOT IT</button>
           </div>
        </div>
      )}

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
            <button onClick={() => socket.emit('start_game', currentRoom)} className="shrink-0 bg-white text-black font-black py-4 px-12 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:scale-110 transition-transform text-xl sm:text-2xl active:scale-105 tracking-widest">
              START MATCH
            </button>
          )}
        </div>
      )}

      {winner && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] bg-black/80 backdrop-blur-md border border-white/20 p-6 sm:p-10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 w-[90vw] max-w-lg pointer-events-auto">
          <h1 className={`text-5xl sm:text-7xl font-black mb-8 tracking-[0.2em] text-center ${getTeamNeon(winner)}`}>{winner.toUpperCase()} WINS</h1>
          <div className="flex gap-4 w-full">
            <button onClick={() => socket.emit('restart_game', currentRoom)} className="flex-1 bg-white text-black font-black py-4 px-4 rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] text-sm sm:text-base">PLAY AGAIN</button>
            <button onClick={handleDisconnect} className="flex-1 bg-transparent border border-white/20 text-white font-bold py-4 px-4 rounded-xl hover:bg-white/10 transition-all text-sm sm:text-base">LEAVE ROOM</button>
          </div>
        </div>
      )}

      {/* --- RE-ARCHITECTED LEFT COLUMN FOR MASSIVE BOARD --- */}
      <div className="flex-1 flex flex-col items-center justify-center w-full relative z-10 md:h-full md:overflow-hidden shrink-0">
        
        {/* NEW SCALING WRAPPER: Constrains width precisely so height never requires scrolling */}
        <div className="w-full max-w-[min(100%,60vh)] mx-auto rounded-xl sm:rounded-[1rem] border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden shrink-0 bg-white/5 p-[2px] sm:p-1 md:p-2 relative transition-all duration-500">
          
          <div className="grid grid-cols-10 gap-[1px] sm:gap-[2px] w-full bg-transparent relative z-10">
            {BOARD_LAYOUT.map((card, idx) => {
              const chip = boardChips[idx];
              const isWinChip = winningLine.includes(idx);
              const isPung = activePings[idx];
              const isLastMove = lastMoveIndex === idx; 
              
              const isValidSpace = isMyTurn && selectedCard && validSpaces.includes(idx);
              const isDimmed = isMyTurn && selectedCard && !validSpaces.includes(idx) && BOARD_LAYOUT[idx] !== 'FREE';

              let cellHighlightStyle = '';
              if (isValidSpace) {
                cellHighlightStyle = 'ring-2 sm:ring-4 ring-cyan-400 z-20 scale-105 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.8)] brightness-110 rounded-[3px] sm:rounded-md';
              } else if (isDimmed) {
                cellHighlightStyle = 'opacity-40 grayscale contrast-75';
              }

              return (
                <div key={idx} onClick={() => handleCellClick(idx)} onContextMenu={(e) => handlePing(e, idx)}
                     className={`relative aspect-[3/4] w-full h-full flex items-center justify-center transition-all duration-300 ${cellHighlightStyle} ${winner && !isWinChip ? 'opacity-30' : ''} ${isPung ? 'ring-2 ring-rose-500 animate-pulse rounded-[3px] sm:rounded-md' : ''}`}>

                  {isPung && <div className="absolute inset-0 bg-rose-500/40 rounded animate-ping pointer-events-none z-20"></div>}

                  <CardVisual card={card} />

                  {chip && (
                    <div 
                      key={`chip-${idx}-${chip}`}
                      className={`absolute w-[80%] sm:w-[75%] aspect-square rounded-full z-10 flex items-center justify-center ${getChipStyle(chip, isWinChip, isLastMove)} pointer-events-none transition-all duration-300`} 
                    />
                  )}
                </div>
              );
            })}
          </div>

          {winner && winningLine.length === 5 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-40 drop-shadow-2xl">
              <line
                pathLength="100"
                x1={`${(winningLine[0] % 10) * 10 + 5}%`}
                y1={`${Math.floor(winningLine[0] / 10) * 10 + 5}%`}
                x2={`${(winningLine[4] % 10) * 10 + 5}%`}
                y2={`${Math.floor(winningLine[4] / 10) * 10 + 5}%`}
                stroke={strokeColor}
                strokeWidth="10"
                strokeLinecap="round"
                className="winning-line"
                style={{ filter: `drop-shadow(0 0 8px ${strokeColor})` }}
              />
            </svg>
          )}
        </div>

        {/* --- COMPACT HAND CONTAINER --- */}
        <div className="w-full shrink-0 flex flex-col items-center mt-3 sm:mt-4">
          <p className="text-[10px] sm:text-xs font-bold opacity-70 mb-2 sm:mb-3 tracking-widest text-center">RIGHT CLICK BOARD TO PING TEAMMATES</p>
          {!winner && (
            <>
              <div className="flex -space-x-3 sm:-space-x-4">
                {(hand || []).map((card, i) => (
                  <div key={`hand-${i}-${card}`} onClick={() => isMyTurn && setSelectedCard(card)} 
                       /* Reduced size here: md:w-14 md:h-20 saves massive vertical space */
                       className={`relative w-10 h-14 sm:w-12 sm:h-16 md:w-14 md:h-20 flex items-center justify-center origin-bottom transition-all duration-300 rounded-[3px] sm:rounded-md card-draw ${selectedCard===card?'ring-2 sm:ring-4 ring-cyan-400 -translate-y-4 sm:-translate-y-6 scale-110 z-20 shadow-[0_0_30px_rgba(34,211,238,0.6)]':'z-0 shadow-lg'} ${isMyTurn?'cursor-pointer hover:-translate-y-2 sm:hover:-translate-y-4':'opacity-50'}`}>
                    <CardVisual card={card} />
                  </div>
                ))}
              </div>
              
              {/* Wrapped trade button in fixed height div so layout doesn't jump when it appears */}
              <div className="h-10 sm:h-12 flex items-center justify-center mt-2 w-full">
                {isMyTurn && isDeadCard && (
                  <button onClick={() => {socket.emit('trade_dead_card', {roomId: currentRoom, playerId: playerIdRef.current, deadCard: selectedCard}); setSelectedCard(null)}} className="bg-rose-600 px-6 py-2 rounded-full font-bold text-[10px] sm:text-xs animate-bounce shadow-lg shadow-rose-500/50 text-white border border-rose-400">TRADE DEAD CARD</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* --- RIGHT COLUMN: MENUS MOVED HERE --- */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col gap-3 min-h-[300px] md:h-full relative z-10 shrink-0">
        
        {/* NEW MOVED CONTROL PANEL */}
        <div className="bg-black/40 border border-white/10 rounded-2xl flex flex-col p-3 shadow-lg shrink-0">
           <div className="w-full flex justify-between items-center mb-2">
             <div className={`font-black tracking-widest text-xs sm:text-sm ${isGameStarted ? getTeamNeon(currentTurn) : 'text-slate-500'}`}>
               {winner ? 'MATCH COMPLETE' : isGameStarted ? `${activePlayerName}'S TURN` : 'STANDBY...'}
             </div>
             
             <div className="flex items-center gap-2">
               <button onClick={() => setShowRules(true)} className="bg-white/10 border border-white/20 text-white px-2 py-1 rounded-md text-[10px] font-bold hover:bg-white/20 transition-colors active:scale-95 tracking-widest flex items-center gap-1">
                 ❓ RULES
               </button>
               <button onClick={handleDisconnect} className="bg-rose-500/20 border border-rose-500/40 text-rose-200 px-2 py-1 rounded-md text-[10px] font-bold hover:bg-rose-500/40 transition-colors active:scale-95 tracking-widest flex items-center gap-1">
                 🚪 QUIT
               </button>
             </div>
           </div>
           
           {isGameStarted && !winner && (
             <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden z-10">
               <div 
                 className={`h-full transition-all duration-1000 linear ${timeLeft <= 10 ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-cyan-400'}`}
                 style={{ width: `${Math.min(100, Math.max(0, (timeLeft / 60) * 100))}%` }}
               />
             </div>
           )}
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl flex flex-col overflow-visible shadow-lg shrink-0">
          <div className="p-2 sm:p-3 border-b border-white/10 font-bold tracking-widest text-[10px] sm:text-xs opacity-70 text-white">LIVE ROSTER</div>
          <div className="p-2 sm:p-3 grid grid-cols-3 gap-2">
            {['red', 'blue', 'green'].map(color => {
              if (!roomInfo[color] || roomInfo[color].length === 0) return null;
              return (
                <div key={color} className="flex flex-col gap-1.5">
                  <span className={`font-black uppercase text-[10px] tracking-wider ${getTeamNeon(color)}`}>{color}</span>
                  {roomInfo[color].map((p, i) => {
                    const isActive = p === activePlayerName && isGameStarted && !winner;
                    const activeEmoteStr = activeEmotes[p] ? activeEmotes[p].split('-')[0] : null;

                    return (
                      <div key={i} className="relative w-full">
                        {activeEmoteStr && (
                          <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-2xl z-50 emote-float drop-shadow-md pointer-events-none">
                            {activeEmoteStr}
                          </span>
                        )}
                        <div className={`truncate px-1.5 py-0.5 rounded text-[10px] sm:text-xs transition-all ${isActive ? 'bg-white/20 text-white font-bold ring-1 ring-white/50 shadow-[0_0_10px_rgba(255,255,255,0.2)] animate-pulse' : 'text-white/60'}`}>
                          {p}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          
          {isGameStarted && (
            <div className="flex justify-between px-3 py-2 border-t border-white/10 bg-black/20">
               {['🤣', '💀', '🔥', '🏆', '🤬', '👋'].map(emote => (
                 <button key={emote} onClick={() => handleSendEmote(emote)} className="text-sm sm:text-base hover:scale-125 transition-transform active:scale-95 opacity-80 hover:opacity-100">
                   {emote}
                 </button>
               ))}
            </div>
          )}
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-lg">
          <div className="p-2 sm:p-3 border-b border-white/10 font-bold tracking-widest text-[10px] sm:text-xs opacity-70 text-white">COMMUNICATIONS</div>
          <div className="chat-scroll-container flex-1 p-2 sm:p-3 overflow-y-auto flex flex-col gap-2 text-sm">
            {chats.map((c, i) => (
              <div key={i} className={`p-2 rounded-lg max-w-[90%] text-white text-xs sm:text-sm ${c.name === playerName ? 'bg-white/20 self-end' : 'bg-black/40 self-start border-l-2'} ${c.team==='red'?'border-rose-500':c.team==='blue'?'border-cyan-500':'border-emerald-500'}`}>
                <span className="font-bold text-[10px] opacity-50 block mb-1 tracking-wider">{c.name}</span>
                {c.msg}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="p-2 border-t border-white/10 flex gap-2 bg-black/60">
            <input type="text" value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Send message..." className="flex-1 bg-transparent focus:outline-none text-xs sm:text-sm px-2 text-white"/>
            <button type="submit" className="bg-white/20 text-white px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-bold active:scale-95 tracking-widest">SEND</button>
          </form>
        </div>

        <div className="h-24 sm:h-32 bg-black/40 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-lg">
          <div className="p-2 sm:p-3 border-b border-white/10 font-bold tracking-widest text-[10px] sm:text-xs opacity-70 text-white">ACTION LOG</div>
          <div className="flex-1 p-2 sm:p-3 overflow-y-auto flex flex-col gap-1 text-[10px] sm:text-xs opacity-80 text-white">
            {logs.map((log, i) => <div key={i} className="border-b border-white/5 pb-1">⚡ {log}</div>)}
          </div>
        </div>
      </div>

    </div>
  );
}
