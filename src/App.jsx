import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { BOARD_LAYOUT } from './constants';

const socket = io.connect('https://sequence-server-g51u.onrender.com'); // Update to Render URL later

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
    socket.on('room_joined', (roomId) => {
      setCurrentRoom(roomId);
      setAppState('team_select');
    });
    socket.on('room_info', (info) => setRoomInfo(info));
    socket.on('assigned_team', (color) => {
      setMyTeam(color);
      setAppState('game');
    });
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
      socket.off('room_joined');
      socket.off('room_info');
      socket.off('assigned_team');
      socket.off('game_state');
      socket.off('your_hand');
      socket.off('error_message');
    };
  }, []);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomInput.trim() !== '' && playerName.trim() !== '') {
      socket.emit('join_room', { roomId: roomInput, playerName: playerName.trim() });
    }
  };

  const handleSelectTeam = (color) => {
    socket.emit('join_team', { roomId: currentRoom, teamColor: color });
  };

  const handleCellClick = (index) => {
    if (winner) return;
    if (socket.id !== activePlayerId) return alert("It is not your turn!");
    if (!selectedCard) return alert("Please select a card from your hand first.");
    
    const targetSpace = BOARD_LAYOUT[index];
    const isCorner = targetSpace === 'FREE';
    if (isCorner) return alert("You cannot play on a FREE corner space.");

    const isTwoEyedJack = selectedCard === 'J♦' || selectedCard === 'J♣';
    const isOneEyedJack = selectedCard === 'J♠' || selectedCard === 'J♥';

    if (isTwoEyedJack) {
      if (boardChips[index] !== null) return alert("Two-Eyed Jacks can only be played on empty spaces.");
    } else if (isOneEyedJack) {
      if (boardChips[index] === null || boardChips[index] === myTeam) return alert("One-Eyed Jacks can only remove an opponent's chip.");
    } else {
      if (boardChips[index] !== null) return alert("That space is already taken.");
      if (selectedCard !== targetSpace) return alert("Your selected card does not match this space!");
    }

    socket.emit('place_chip', { roomId: currentRoom, index: index, teamColor: myTeam, playedCard: selectedCard });
    setHand(hand.filter(card => card !== selectedCard));
    setSelectedCard(null);
  };

  const handleRestartGame = () => {
    socket.emit('restart_game', currentRoom);
  };

  const getCardColor = (cardString) => {
    if (!cardString) return 'text-gray-900';
    if (cardString.includes('♥') || cardString.includes('♦')) return 'text-red-600';
    return 'text-gray-900';
  };

  const getTeamTextColor = (team) => {
    if (team === 'red') return 'text-red-400';
    if (team === 'blue') return 'text-blue-400';
    if (team === 'green') return 'text-emerald-400';
    return 'text-gray-300';
  };

  // Helper for 3D Chip styling
  const getChipStyle = (color) => {
    if (color === 'red') return 'bg-gradient-to-br from-red-400 to-red-700 border-red-900 shadow-[inset_0_3px_4px_rgba(255,255,255,0.4),inset_0_-3px_4px_rgba(0,0,0,0.5),0_4px_5px_rgba(0,0,0,0.6)]';
    if (color === 'blue') return 'bg-gradient-to-br from-blue-400 to-blue-700 border-blue-900 shadow-[inset_0_3px_4px_rgba(255,255,255,0.4),inset_0_-3px_4px_rgba(0,0,0,0.5),0_4px_5px_rgba(0,0,0,0.6)]';
    if (color === 'green') return 'bg-gradient-to-br from-emerald-400 to-emerald-700 border-emerald-900 shadow-[inset_0_3px_4px_rgba(255,255,255,0.4),inset_0_-3px_4px_rgba(0,0,0,0.5),0_4px_5px_rgba(0,0,0,0.6)]';
    return '';
  };

  // Shared App Background
  const appBackground = "min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-800 via-green-950 to-black text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden";

  // ================= LOBBY UI =================
  if (appState === 'lobby') {
    return (
      <div className={appBackground}>
        {/* Background decorative elements */}
        <div className="absolute top-10 left-10 w-64 h-64 bg-green-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-yellow-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-10"></div>
        
        <div className="bg-white/10 backdrop-blur-xl p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 text-center max-w-md w-full relative z-10">
          <h1 className="text-5xl font-extrabold mb-2 tracking-[0.2em] bg-gradient-to-b from-yellow-200 to-yellow-600 text-transparent bg-clip-text drop-shadow-lg">
            SEQUENCE
          </h1>
          <p className="mb-8 text-green-100 font-light tracking-wide">Enter a room code to start playing</p>
          <form onSubmit={handleJoinRoom} className="flex flex-col gap-5">
            <input type="text" placeholder="Your Name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="p-4 text-xl text-white bg-black/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center font-semibold placeholder-gray-400 transition-all" required maxLength={15}/>
            <input type="text" placeholder="Room Code" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} className="p-4 text-xl text-white bg-black/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center font-semibold placeholder-gray-400 transition-all" required/>
            <button type="submit" className="mt-2 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-extrabold text-xl py-4 rounded-xl hover:from-yellow-500 hover:to-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all transform hover:scale-[1.02]">
              ENTER LOBBY
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= TEAM SELECT UI =================
  if (appState === 'team_select') {
    return (
      <div className={appBackground}>
        <div className="bg-white/10 backdrop-blur-xl p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 text-center max-w-4xl w-full">
          <h2 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500">ROOM: {currentRoom}</h2>
          <div className="mb-10">
            <p className="text-gray-300 text-lg">Select your alliance</p>
            <p className="text-yellow-400/80 text-sm font-bold tracking-widest mt-2">PLAYERS JOINED: {roomInfo.total} / 12</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {['red', 'blue', 'green'].map((color) => {
              const count = roomInfo[color].length;
              const isFull = count >= 4;
              const btnColors = {
                red: 'from-red-600 to-red-800 border-red-500 hover:from-red-500 hover:to-red-700 shadow-red-500/30',
                blue: 'from-blue-600 to-blue-800 border-blue-500 hover:from-blue-500 hover:to-blue-700 shadow-blue-500/30',
                green: 'from-emerald-600 to-emerald-800 border-emerald-500 hover:from-emerald-500 hover:to-emerald-700 shadow-emerald-500/30'
              };
              
              return (
                <div key={color} className="flex flex-col gap-3">
                  <button onClick={() => handleSelectTeam(color)} disabled={isFull} 
                    className={`bg-gradient-to-br border-t border-l ${isFull ? 'from-gray-700 to-gray-900 border-gray-600 opacity-60 cursor-not-allowed' : `${btnColors[color]} hover:-translate-y-1`} 
                    text-white font-black text-xl py-5 rounded-2xl shadow-xl transition-all duration-300`}
                  >
                    JOIN {color.toUpperCase()} ({count}/4)
                  </button>
                  <div className="bg-black/40 border border-white/10 p-4 rounded-xl text-sm min-h-[80px] flex items-center justify-center">
                    <span className={count > 0 ? 'text-white' : 'text-gray-500 italic'}>
                      {count > 0 ? roomInfo[color].join(', ') : 'Empty seats'}
                    </span>
                  </div>
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
    <div className={appBackground}>
      
      {/* Game Over Screen */}
      {winner && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="bg-white/10 border border-white/20 p-12 rounded-3xl shadow-2xl text-center">
            <h1 className={`text-7xl font-black mb-8 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] uppercase ${getTeamTextColor(winner)}`}>
              {winner} TEAM WINS!
            </h1>
            <div className="flex justify-center gap-6">
              <button onClick={handleRestartGame} className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-extrabold py-4 px-10 rounded-xl hover:from-yellow-400 hover:to-yellow-500 hover:scale-105 transition-all shadow-[0_0_20px_rgba(234,179,8,0.5)] text-xl">
                Play Again
              </button>
              <button onClick={() => window.location.reload()} className="bg-white/10 border border-white/20 text-white font-bold py-4 px-8 rounded-xl hover:bg-white/20 transition-all text-xl">
                Leave Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roster Bar */}
      <div className="w-full max-w-5xl bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 mb-6 flex flex-wrap justify-center gap-8 text-xs md:text-sm shadow-lg">
        <div className="text-gray-300"><span className="font-black text-red-500 drop-shadow-md">RED:</span> {roomInfo.red.join(', ') || '-'}</div>
        <div className="text-gray-300"><span className="font-black text-blue-500 drop-shadow-md">BLUE:</span> {roomInfo.blue.join(', ') || '-'}</div>
        <div className="text-gray-300"><span className="font-black text-emerald-500 drop-shadow-md">GREEN:</span> {roomInfo.green.join(', ') || '-'}</div>
      </div>

      {/* Header Info */}
      <div className="mb-6 w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold tracking-[0.2em] bg-gradient-to-b from-yellow-200 to-yellow-600 text-transparent bg-clip-text drop-shadow-lg hidden md:block">
          SEQUENCE
        </h1>
        
        <div className="flex gap-6 items-center justify-center bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 shadow-xl">
          <p className="text-sm md:text-lg font-medium text-gray-200">
            Team: <span className={`font-black ml-1 ${getTeamTextColor(myTeam)} drop-shadow-md`}>{myTeam.toUpperCase()}</span>
          </p>
          <div className="w-[1px] h-8 bg-white/20"></div>
          
          <p className={`text-sm md:text-lg font-medium transition-all ${isMyTurn ? 'text-yellow-300 scale-105' : 'text-gray-200'}`}>
            Turn: <span className={`font-black ml-1 ${getTeamTextColor(currentTurn)} drop-shadow-md`}>
              {activePlayerName}
            </span>
          </p>
        </div>
      </div>

      {/* Game Board Container (Golden Rim) */}
      <div className={`p-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] mb-8 transition-all duration-500 bg-gradient-to-br 
        ${isMyTurn ? 'from-yellow-400 via-yellow-600 to-yellow-700 scale-[1.01] shadow-yellow-500/20' : 'from-yellow-700 via-yellow-800 to-yellow-900'}`}>
        
        <div className="grid grid-cols-10 grid-rows-10 gap-1 bg-green-950 p-1.5 rounded-xl w-full max-w-5xl">
          {BOARD_LAYOUT.map((cardValue, index) => {
            const isCorner = cardValue === 'FREE';
            const chipColor = boardChips[index];
            
            let isMatch = false;
            const isTwoEyed = selectedCard === 'J♦' || selectedCard === 'J♣';
            const isOneEyed = selectedCard === 'J♠' || selectedCard === 'J♥';

            if (!isCorner && isMyTurn) {
              if (isTwoEyed && chipColor === null) isMatch = true;
              else if (isOneEyed && chipColor !== null && chipColor !== myTeam) isMatch = true; 
              else if (selectedCard === cardValue && chipColor === null) isMatch = true;
            }
            
            return (
              <div
                key={index}
                onClick={() => !isCorner && handleCellClick(index)}
                className={`
                  relative w-10 h-14 md:w-16 md:h-24 border rounded-md flex flex-col items-center justify-center cursor-pointer transition-all duration-200 shadow-sm
                  ${isCorner ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 border-yellow-600 shadow-inner' : 'bg-gradient-to-br from-gray-50 to-gray-200 border-gray-300 hover:brightness-95'}
                  ${isMatch ? 'ring-4 ring-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.8)] scale-110 z-10 brightness-110' : ''}
                `}
              >
                {!isCorner ? (
                  <span className={`font-extrabold text-sm md:text-xl drop-shadow-sm ${getCardColor(cardValue)}`}>{cardValue}</span>
                ) : (
                  <span className="text-yellow-900 font-black text-[10px] md:text-sm tracking-widest opacity-80">FREE</span>
                )}
                
                {/* 3D Chip */}
                {chipColor && (
                  <div className={`
                    absolute w-7 h-7 md:w-12 md:h-12 rounded-full border-2 transition-all z-0
                    ${getChipStyle(chipColor)}
                    ${isMatch && isOneEyed ? 'animate-pulse opacity-50 ring-2 ring-red-500 ring-offset-1' : ''}
                  `}>
                    {/* Inner detail for chip */}
                    <div className="absolute inset-1 border border-white/20 rounded-full border-dashed opacity-50"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hand Container */}
      <div className={`bg-white/5 backdrop-blur-md p-6 rounded-3xl border shadow-2xl w-full max-w-5xl transition-all duration-500
        ${isMyTurn ? 'border-yellow-400/50 shadow-[0_0_30px_rgba(234,179,8,0.15)]' : 'border-white/10'}
      `}>
        <h3 className={`text-center font-bold mb-5 tracking-widest text-sm transition-colors ${isMyTurn ? 'text-yellow-400' : 'text-gray-400'}`}>
          {isMyTurn ? "YOUR TURN: SELECT A CARD TO PLAY" : "WAITING FOR YOUR TURN..."}
        </h3>
        <div className="flex gap-3 md:gap-6 items-center justify-center flex-wrap">
          {hand.map((card, index) => (
            <div 
              key={index} 
              onClick={() => isMyTurn && setSelectedCard(card)}
              className={`
                relative w-14 h-20 md:w-24 md:h-36 bg-gradient-to-br from-white to-gray-200 rounded-xl flex flex-col items-center justify-center transition-all duration-300
                ${selectedCard === card ? 'ring-4 ring-yellow-400 -translate-y-6 shadow-[0_15px_30px_rgba(0,0,0,0.5)] scale-110' : 'border border-gray-300 shadow-md'}
                ${isMyTurn ? 'cursor-pointer hover:-translate-y-2 hover:shadow-xl' : 'opacity-60 cursor-not-allowed grayscale-[0.2]'}
              `}
            >
              <span className={`font-black text-xl md:text-4xl drop-shadow-sm ${getCardColor(card)}`}>{card}</span>
              
              {/* Special Card Indicators */}
              {(card === 'J♦' || card === 'J♣') && (
                <span className="absolute bottom-2 bg-emerald-100 text-emerald-800 text-[8px] md:text-xs font-black px-2 py-0.5 rounded shadow-sm">WILD</span>
              )}
              {(card === 'J♠' || card === 'J♥') && (
                <span className="absolute bottom-2 bg-red-100 text-red-800 text-[8px] md:text-xs font-black px-2 py-0.5 rounded shadow-sm">REMOVE</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
