import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { BOARD_LAYOUT } from './constants';

const socket = io.connect('https://sequence-server-g51u.onrender.com'); 

// SFX Configuration (Optional: replace empty strings with real mp3 URLs)
const playSound = (type) => {
  const sounds = {
    play: new Audio(''),   // e.g., 'https://your-url.com/card-snap.mp3'
    remove: new Audio(''), 
    win: new Audio(''),
    chat: new Audio('')
  };
  if (sounds[type] && sounds[type].src) sounds[type].play().catch(e => console.log('Audio blocked'));
};

const getSessionPlayerId = () => {
  let pid = sessionStorage.getItem('sequence_playerId');
  if (!pid) { pid = 'player_' + Math.random().toString(36).substr(2, 9); sessionStorage.setItem('sequence_playerId', pid); }
  return pid;
};

export default function SequenceGame() {
  const [playerId] = useState(getSessionPlayerId());
  
  const [appState, setAppState] = useState('lobby');
  const [roomInput, setRoomInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomInfo, setRoomInfo] = useState({ red: [], blue: [], green: [], unassigned: [], total: 0 });

  const [boardChips, setBoardChips] = useState(Array(100).fill(null));
  const [currentTurn, setCurrentTurn] = useState('red');
  const [winner, setWinner] = useState(null);
  const [winningLine, setWinningLine] = useState([]);
  
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [activePlayerName, setActivePlayerName] = useState('Waiting...');
  const [turnDeadline, setTurnDeadline] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);

  const [myTeam, setMyTeam] = useState('');
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  
  const [logs, setLogs] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chats, setChats] = useState([]);

  useEffect(() => {
    const savedRoom = sessionStorage.getItem('sequence_room');
    const savedName = sessionStorage.getItem('sequence_name');
    if (savedRoom && savedName) {
      setRoomInput(savedRoom); setPlayerName(savedName);
      socket.emit('join_room', { roomId: savedRoom, playerName: savedName, playerId });
    }
  }, [playerId]);

  useEffect(() => {
    socket.on('room_joined', (roomId) => { setCurrentRoom(roomId); setAppState('team_select'); });
    socket.on('room_info', setRoomInfo);
    socket.on('assigned_team', (color) => { setMyTeam(color); setAppState('game'); });
    
    socket.on('game_state', (gameState) => {
      setBoardChips(gameState.board); setCurrentTurn(gameState.turn);
      setActivePlayerId(gameState.activePlayerId); setActivePlayerName(gameState.activePlayerName);
      setLogs(gameState.logs); setTurnDeadline(gameState.turnDeadline);
      if (gameState.winner && !winner) playSound('win');
      setWinner(gameState.winner); setWinningLine(gameState.winningLine || []);
    });
    
    socket.on('your_hand', setHand);
    socket.on('chat_message', (msg) => { setChats(prev => [...prev, msg]); playSound('chat'); });
    
    socket.on('game_restarted', (allHands) => {
      if (allHands[playerId]) { setHand(allHands[playerId]); setSelectedCard(null); }
      setChats([]);
    });

    socket.on('error_message', alert);
    
    return () => socket.offAny();
  }, [playerId, winner]);

  // Turn Timer Countdown
  useEffect(() => {
    if (!turnDeadline || winner) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((turnDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && socket.id === activePlayerId) {
        socket.emit('timeout_skip', { roomId: currentRoom, playerId });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [turnDeadline, winner, activePlayerId, currentRoom, playerId]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomInput.trim() && playerName.trim()) {
      sessionStorage.setItem('sequence_room', roomInput.trim());
      sessionStorage.setItem('sequence_name', playerName.trim());
      socket.emit('join_room', { roomId: roomInput.trim(), playerName: playerName.trim(), playerId });
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      socket.emit('send_chat', { roomId: currentRoom, playerId, msg: chatInput });
      setChatInput('');
    }
  };

  const checkDeadCard = (card) => {
    if (card.includes('J')) return false;
    const indices = BOARD_LAYOUT.map((c, i) => c === card ? i : -1).filter(i => i !== -1);
    return indices.every(i => boardChips[i] !== null);
  };

  const handleCellClick = (index) => {
    if (winner || playerId !== activePlayerId || !selectedCard || BOARD_LAYOUT[index] === 'FREE') return;
    
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

  // Theme Helpers
  const getTeamNeon = (team) => team === 'red' ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]' : team === 'blue' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : team === 'green' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'text-slate-400';
  const getChipStyle = (color, isWin) => {
    const base = color === 'red' ? 'from-rose-400 to-rose-900 ring-rose-300' : color === 'blue' ? 'from-cyan-400 to-cyan-900 ring-cyan-300' : 'from-emerald-400 to-emerald-900 ring-emerald-300';
    return `bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] ${base} shadow-inner ring-1 ${isWin ? 'animate-bounce ring-4 shadow-[0_0_30px_rgba(255,255,255,1)] brightness-150' : ''}`;
  };

  const layoutContainer = "min-h-[100dvh] w-full bg-[#0a0f1a] text-white flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden selection:bg-rose-500/30 font-sans";

  if (appState === 'lobby' || appState === 'team_select') return (
    <div className={layoutContainer}>
       <div className="backdrop-blur-2xl bg-white/[0.02] border border-white/10 p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
          <h1 className="text-5xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-cyan-400 tracking-[0.2em]">SEQUENCE</h1>
          {appState === 'lobby' ? (
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
              <input type="text" placeholder="Name" value={playerName} onChange={e=>setPlayerName(e.target.value)} className="w-full p-4 bg-slate-900/50 rounded-xl text-center font-bold" required />
              <input type="text" placeholder="Room Code" value={roomInput} onChange={e=>setRoomInput(e.target.value)} className="w-full p-4 bg-slate-900/50 rounded-xl text-center font-bold uppercase" required />
              <button className="bg-white text-black font-black py-4 rounded-xl mt-4">JOIN SQUAD</button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              {['red','blue','green'].map(color => (
                <button key={color} onClick={() => socket.emit('join_team', {roomId: currentRoom, teamColor: color, playerId})} disabled={roomInfo[color].length >=4} className="border border-white/20 py-4 rounded-xl font-bold uppercase hover:bg-white/10">{color} ({roomInfo[color].length}/4)</button>
              ))}
            </div>
          )}
       </div>
    </div>
  );

  const isMyTurn = playerId === activePlayerId;
  const isDeadCard = selectedCard && checkDeadCard(selectedCard);

  return (
    <div className="min-h-[100dvh] bg-[#0a0f1a] text-white flex flex-col md:flex-row p-2 sm:p-4 gap-4 overflow-hidden font-sans relative">
      
      {/* LEFT: Game Board */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
        <div className="w-full flex justify-between bg-white/[0.03] border border-white/10 p-3 rounded-2xl mb-4 shadow-lg backdrop-blur-md">
           <div className={`font-black tracking-widest ${getTeamNeon(currentTurn)}`}>{activePlayerName}'S TURN</div>
           {!winner && <div className={`font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>{timeLeft}s</div>}
        </div>

        <div className={`w-full p-2 rounded-[2rem] border transition-all ${isMyTurn && !winner ? 'bg-white/[0.05] border-white/30' : 'bg-black/40 border-white/10'}`}>
          <div className="grid grid-cols-10 gap-0.5 sm:gap-1 w-full">
            {BOARD_LAYOUT.map((card, idx) => {
              const chip = boardChips[idx];
              const isWinChip = winningLine.includes(idx);
              const isMatch = isMyTurn && selectedCard && !winner && ((card === selectedCard && !chip) || (selectedCard.includes('J') && ((selectedCard.includes('♦')||selectedCard.includes('♣'))?!chip:chip&&chip!==myTeam)));
              
              return (
                <div key={idx} onClick={() => handleCellClick(idx)} className={`relative aspect-[3/4] rounded flex items-center justify-center ${card==='FREE'?'bg-amber-400':'bg-slate-200'} ${isMatch?'ring-4 ring-white z-10 scale-110 cursor-pointer':''} ${winner && !isWinChip ? 'opacity-30' : ''}`}>
                  {card!=='FREE' && <span className={`font-black text-[9px] sm:text-xs md:text-sm ${card.includes('♥')||card.includes('♦')?'text-rose-600':'text-slate-900'}`}>{card}</span>}
                  {chip && <div className={`absolute w-[70%] h-[70%] rounded-full ${getChipStyle(chip, isWinChip)}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hand Area */}
        <div className="w-full mt-6 flex flex-col items-center">
          <div className="flex -space-x-4">
            {hand.map((card, i) => (
              <div key={i} onClick={() => isMyTurn && setSelectedCard(card)} className={`relative w-16 h-24 sm:w-20 sm:h-28 bg-slate-100 rounded-lg border-2 flex items-center justify-center origin-bottom transition-all ${selectedCard===card?'border-rose-500 -translate-y-6 scale-110 z-20':'border-white/20 z-0'} ${isMyTurn?'cursor-pointer hover:-translate-y-4':'opacity-50'}`}>
                <span className={`font-black text-xl sm:text-2xl ${card.includes('♥')||card.includes('♦')?'text-rose-600':'text-slate-900'}`}>{card}</span>
              </div>
            ))}
          </div>
          {isMyTurn && isDeadCard && (
            <button onClick={() => {socket.emit('trade_dead_card', {roomId: currentRoom, playerId, deadCard: selectedCard}); setSelectedCard(null)}} className="mt-4 bg-rose-600 px-6 py-2 rounded-full font-bold animate-bounce shadow-lg shadow-rose-500/50">TRADE DEAD CARD</button>
          )}
        </div>
      </div>

      {/* RIGHT: Social Panel (Chat & Logs) */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col gap-4 max-h-[100dvh]">
        {winner ? (
          <div className="bg-white/10 p-6 rounded-2xl border border-white/20 text-center animate-pulse">
            <h2 className="text-3xl font-black text-white mb-4">GAME OVER</h2>
            <button onClick={handleRestartGame} className="w-full bg-yellow-500 text-black py-3 rounded-xl font-bold mb-2">PLAY AGAIN</button>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-white/10 font-bold tracking-widest text-xs text-slate-400">COMMUNICATIONS</div>
            
            {/* Chat Messages */}
            <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 text-sm">
              {chats.map((c, i) => (
                <div key={i} className={`p-2 rounded-lg max-w-[90%] ${c.name === playerName ? 'bg-white/20 self-end' : 'bg-black/40 self-start border-l-2'} ${c.team==='red'?'border-rose-500':c.team==='blue'?'border-cyan-500':'border-emerald-500'}`}>
                  <span className="font-bold text-xs opacity-50 block mb-1">{c.name}</span>
                  {c.msg}
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="p-2 border-t border-white/10 flex gap-2 bg-black/20">
              <input type="text" value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Send message..." className="flex-1 bg-transparent focus:outline-none text-sm px-2"/>
              <button type="submit" className="bg-white/20 px-3 py-1 rounded-md text-xs font-bold">SEND</button>
            </form>
          </div>
        )}

        {/* Action Logs */}
        <div className="h-48 bg-black/40 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10 font-bold tracking-widest text-xs text-slate-400">ACTION LOG</div>
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-1 text-xs text-slate-300">
            {logs.map((log, i) => <div key={i} className="border-b border-white/5 pb-1">⚡ {log}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
