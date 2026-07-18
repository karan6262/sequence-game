import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { BOARD_LAYOUT } from './constants';

const socket = io.connect('https://sequence-server-g51u.onrender.com'); // Update to Render URL for production

export default function SequenceGame() {
  const [appState, setAppState] = useState('lobby');
  const [roomInput, setRoomInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomInfo, setRoomInfo] = useState({ red: [], blue: [], green: [], unassigned: [], total: 0 });

  const [boardChips, setBoardChips] = useState(Array(100).fill(null));
  const [currentTurn, setCurrentTurn] = useState('red');
  const [winner, setWinner] = useState(null);
  
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [activePlayerName, setActivePlayerName] = useState('Waiting...');

  const [myTeam, setMyTeam] = useState('');
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    socket.on('room_joined', (roomId) => { setCurrentRoom(roomId); setAppState('team_select'); });
    socket.on('room_info', (info) => setRoomInfo(info));
    socket.on('assigned_team', (color) => { setMyTeam(color); setAppState('game'); });
    socket.on('game_state', (gameState) => {
      setBoardChips(gameState.board);
      setCurrentTurn(gameState.turn);
      setActivePlayerId(gameState.activePlayerId);
      setActivePlayerName(gameState.activePlayerName);
      setWinner(gameState.winner);
    });
    socket.on('your_hand', (dealtHand) => setHand(dealtHand));
    socket.on('error_message', (msg) => alert(msg));
    
    return () => {
      socket.off('room_joined'); socket.off('room_info'); socket.off('assigned_team');
      socket.off('game_state'); socket.off('your_hand'); socket.off('error_message');
    };
  }, []);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomInput.trim() && playerName.trim()) socket.emit('join_room', { roomId: roomInput, playerName: playerName.trim() });
  };

  const handleSelectTeam = (color) => socket.emit('join_team', { roomId: currentRoom, teamColor: color });

  const handleCellClick = (index) => {
    if (winner || socket.id !== activePlayerId) return;
    if (!selectedCard) return alert("Select a card from your hand first.");
    
    const targetSpace = BOARD_LAYOUT[index];
    if (targetSpace === 'FREE') return;

    const isTwoEyed = selectedCard === 'J♦' || selectedCard === 'J♣';
    const isOneEyed = selectedCard === 'J♠' || selectedCard === 'J♥';

    if (isTwoEyed && boardChips[index] !== null) return;
    if (isOneEyed && (boardChips[index] === null || boardChips[index] === myTeam)) return;
    if (!isTwoEyed && !isOneEyed && (boardChips[index] !== null || selectedCard !== targetSpace)) return;

    socket.emit('place_chip', { roomId: currentRoom, index, teamColor: myTeam, playedCard: selectedCard });
    setHand(hand.filter(card => card !== selectedCard));
    setSelectedCard(null);
  };

  const handleRestartGame = () => socket.emit('restart_game', currentRoom);

  // Theme Helpers
  const getCardColor = (card) => (card.includes('♥') || card.includes('♦') ? 'text-rose-600' : 'text-slate-900');
  const getTeamNeon = (team) => {
    if (team === 'red') return 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]';
    if (team === 'blue') return 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]';
    if (team === 'green') return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]';
    return 'text-slate-400';
  };
  
  const getChipStyle = (color) => {
    if (color === 'red') return 'bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-rose-400 via-rose-600 to-rose-900 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_2px_5px_rgba(0,0,0,0.8)] ring-1 ring-rose-300';
    if (color === 'blue') return 'bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-cyan-400 via-cyan-600 to-cyan-900 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_2px_5px_rgba(0,0,0,0.8)] ring-1 ring-cyan-300';
    if (color === 'green') return 'bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-400 via-emerald-600 to-emerald-900 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_2px_5px_rgba(0,0,0,0.8)] ring-1 ring-emerald-300';
    return '';
  };

  const layoutContainer = "min-h-[100dvh] w-full bg-[#0a0f1a] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] text-white flex flex-col items-center justify-center p-2 sm:p-6 font-sans relative overflow-x-hidden selection:bg-rose-500/30";

  // ================= LOBBY UI =================
  if (appState === 'lobby') {
    return (
      <div className={layoutContainer}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-64 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="backdrop-blur-2xl bg-white/[0.02] border border-white/10 p-8 sm:p-12 rounded-[2rem] shadow-2xl w-full max-w-md relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black mb-2 text-center tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-purple-400 to-cyan-400">
            SEQUENCE
          </h1>
          <p className="mb-10 text-slate-400 text-center text-sm font-medium">NEXT GEN BOARD EXPERIENCE</p>
          <form onSubmit={handleJoinRoom} className="flex flex-col gap-6">
            <div className="relative group">
              <input type="text" placeholder="Player Name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-center font-bold tracking-widest text-white transition-all group-hover:border-slate-500" required maxLength={15}/>
            </div>
            <div className="relative group">
              <input type="text" placeholder="Room Code" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-center font-bold tracking-widest text-white uppercase transition-all group-hover:border-slate-500" required/>
            </div>
            <button type="submit" className="w-full mt-4 bg-white text-black font-black text-lg py-4 rounded-xl hover:bg-slate-200 transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              INITIALIZE PROTOCOL
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= TEAM SELECT UI =================
  if (appState === 'team_select') {
    return (
      <div className={layoutContainer}>
        <div className="backdrop-blur-2xl bg-white/[0.02] border border-white/10 p-6 sm:p-12 rounded-[2rem] shadow-2xl w-full max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-slate-400 text-sm tracking-widest mb-2">SECURE ROOM</p>
            <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-widest">{currentRoom}</h2>
            <p className="mt-4 text-cyan-400 text-sm font-bold tracking-[0.2em]">{roomInfo.total} / 12 OPERATIVES CONNECTED</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {['red', 'blue', 'green'].map((color) => {
              const isFull = roomInfo[color].length >= 4;
              const styles = {
                red: 'from-rose-500/20 to-rose-900/20 border-rose-500/30 hover:border-rose-500',
                blue: 'from-cyan-500/20 to-cyan-900/20 border-cyan-500/30 hover:border-cyan-500',
                green: 'from-emerald-500/20 to-emerald-900/20 border-emerald-500/30 hover:border-emerald-500'
              };
              
              return (
                <div key={color} className={`bg-gradient-to-b ${styles[color]} border rounded-3xl p-6 flex flex-col transition-all duration-300`}>
                  <h3 className={`text-center font-black tracking-widest text-2xl mb-6 ${getTeamNeon(color)}`}>{color.toUpperCase()}</h3>
                  <div className="flex-1 min-h-[100px] mb-6 space-y-2">
                    {roomInfo[color].map((p, i) => (
                      <div key={i} className="bg-black/40 px-4 py-2 rounded-lg text-sm font-bold border border-white/5 flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${color === 'red' ? 'bg-rose-500' : color === 'blue' ? 'bg-cyan-500' : 'bg-emerald-500'}`}></div>
                        {p}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => handleSelectTeam(color)} disabled={isFull} className={`w-full py-4 rounded-xl font-black tracking-widest transition-all ${isFull ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white text-black hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.3)]'}`}>
                    {isFull ? 'SQUAD FULL' : 'JOIN SQUAD'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ================= GAME UI =================
  const isMyTurn = socket.id === activePlayerId;

  return (
    <div className={layoutContainer}>
      {/* Background glow syncing with turn */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[60vh] rounded-full blur-[150px] pointer-events-none opacity-10 transition-colors duration-1000
        ${currentTurn === 'red' ? 'bg-rose-500' : currentTurn === 'blue' ? 'bg-cyan-500' : 'bg-emerald-500'}
      `}></div>

      {winner && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center">
          <h1 className={`text-5xl sm:text-7xl font-black mb-10 tracking-[0.2em] ${getTeamNeon(winner)}`}>{winner} WINS</h1>
          <div className="flex gap-6">
            <button onClick={handleRestartGame} className="bg-white text-black font-black py-4 px-8 rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]">PLAY AGAIN</button>
            <button onClick={() => window.location.reload()} className="bg-transparent border border-white/20 text-white font-bold py-4 px-8 rounded-xl hover:bg-white/10 transition-all">DISCONNECT</button>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto flex flex-col h-full z-10 pt-2 sm:pt-4">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 p-3 sm:p-5 rounded-2xl mb-4 sm:mb-6 backdrop-blur-md shadow-xl">
          <div className="hidden md:block text-2xl font-black tracking-[0.3em] text-white">SEQ<span className="text-slate-500">UENCE</span></div>
          
          {/* Turn Indicator */}
          <div className="flex-1 flex justify-center">
            <div className={`flex items-center gap-3 px-6 py-2 rounded-full border ${isMyTurn ? 'border-white/50 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'border-white/10 bg-black/40'} transition-all`}>
              <div className="text-xs sm:text-sm font-medium text-slate-400 tracking-widest uppercase">Target:</div>
              <div className={`text-sm sm:text-base font-black tracking-widest ${getTeamNeon(currentTurn)} ${isMyTurn ? 'animate-pulse' : ''}`}>
                {activePlayerName}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <div className="text-xs font-bold text-slate-400 tracking-widest">SQUAD:</div>
            <div className={`text-sm font-black tracking-widest ${getTeamNeon(myTeam)}`}>{myTeam.toUpperCase()}</div>
          </div>
        </div>

        {/* Dynamic Board Container */}
        <div className="flex-1 w-full flex items-center justify-center mb-4 sm:mb-6">
          <div className={`w-full max-w-xs sm:max-w-2xl md:max-w-3xl lg:max-w-4xl p-2 sm:p-4 rounded-2xl sm:rounded-[2rem] border transition-all duration-500 shadow-2xl backdrop-blur-sm
            ${isMyTurn ? 'bg-white/[0.05] border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.1)]' : 'bg-black/40 border-white/10'}
          `}>
            {/* 10x10 Grid */}
            <div className="grid grid-cols-10 gap-0.5 sm:gap-1 lg:gap-1.5 w-full">
              {BOARD_LAYOUT.map((cardValue, index) => {
                const isCorner = cardValue === 'FREE';
                const chipColor = boardChips[index];
                let isMatch = false;
                
                if (!isCorner && isMyTurn && selectedCard) {
                  const isTwoEyed = selectedCard === 'J♦' || selectedCard === 'J♣';
                  const isOneEyed = selectedCard === 'J♠' || selectedCard === 'J♥';
                  if (isTwoEyed && chipColor === null) isMatch = true;
                  else if (isOneEyed && chipColor !== null && chipColor !== myTeam) isMatch = true; 
                  else if (selectedCard === cardValue && chipColor === null) isMatch = true;
                }
                
                return (
                  <div
                    key={index}
                    onClick={() => !isCorner && handleCellClick(index)}
                    className={`
                      relative w-full aspect-[2/3] sm:aspect-[3/4] rounded-sm sm:rounded-md lg:rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300 select-none
                      ${isCorner ? 'bg-gradient-to-br from-amber-200 to-yellow-500' : 'bg-[#e2e8f0] hover:bg-white'}
                      ${isMatch ? 'ring-2 sm:ring-4 ring-white z-10 scale-[1.15] sm:scale-110 shadow-xl' : 'shadow-sm'}
                    `}
                  >
                    {!isCorner ? (
                      <span className={`font-black text-[9px] sm:text-xs md:text-sm lg:text-lg tracking-tighter ${getCardColor(cardValue)} leading-none`}>
                        {cardValue}
                      </span>
                    ) : (
                      <span className="text-yellow-900 font-black text-[6px] sm:text-[10px] md:text-xs lg:text-sm tracking-widest opacity-70">FREE</span>
                    )}
                    
                    {chipColor && (
                      <div className={`
                        absolute w-[70%] h-[70%] rounded-full transition-all z-0 flex items-center justify-center
                        ${getChipStyle(chipColor)}
                        ${isMatch && selectedCard?.includes('J') ? 'animate-pulse opacity-50 ring-2 ring-red-500' : ''}
                      `}>
                        <div className="w-[60%] h-[60%] border-[0.5px] sm:border border-white/30 rounded-full border-dashed"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Hand Area (Overlapping Cards Effect) */}
        <div className="w-full pb-4 sm:pb-8 flex flex-col items-center">
          <p className={`text-xs sm:text-sm font-bold tracking-[0.2em] mb-4 sm:mb-6 transition-colors ${isMyTurn ? 'text-white' : 'text-slate-500'}`}>
            {isMyTurn ? "DEPLOY ASSET" : "STANDBY"}
          </p>
          
          <div className="flex justify-center items-end h-24 sm:h-36 -space-x-4 sm:-space-x-8 px-4">
            {hand.map((card, index) => {
              const isSelected = selectedCard === card;
              return (
                <div 
                  key={index} 
                  onClick={() => isMyTurn && setSelectedCard(card)}
                  className={`
                    relative w-16 h-24 sm:w-24 sm:h-36 bg-gradient-to-br from-white to-slate-200 rounded-xl sm:rounded-2xl border-2 sm:border-4 flex flex-col items-center justify-center transition-all duration-300 origin-bottom
                    ${isSelected ? 'border-white -translate-y-8 sm:-translate-y-12 z-20 shadow-[0_20px_40px_rgba(0,0,0,0.8)] scale-110' : 'border-white/20 shadow-xl z-0'}
                    ${isMyTurn ? 'cursor-pointer hover:-translate-y-4 sm:hover:-translate-y-6 hover:z-10 hover:rotate-2' : 'opacity-50 cursor-not-allowed grayscale-[50%]'}
                  `}
                >
                  <span className={`font-black text-xl sm:text-3xl lg:text-4xl drop-shadow-sm ${getCardColor(card)}`}>{card}</span>
                  
                  {/* Wild Indicators */}
                  {(card === 'J♦' || card === 'J♣') && (
                    <span className="absolute bottom-1 sm:bottom-2 bg-emerald-500 text-black text-[6px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded shadow-sm tracking-widest">WILD</span>
                  )}
                  {(card === 'J♠' || card === 'J♥') && (
                    <span className="absolute bottom-1 sm:bottom-2 bg-rose-500 text-white text-[6px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded shadow-sm tracking-widest">REMOVE</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
      </div>
    </div>
  );
}
