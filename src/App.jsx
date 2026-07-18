import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { BOARD_LAYOUT } from './constants';

// Update this to your deployed Render URL if hosting, or keep localhost for local testing
const socket = io.connect('http://localhost:3001');

export default function SequenceGame() {
  const [appState, setAppState] = useState('lobby');
  const [roomInput, setRoomInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);

  // roomInfo now holds arrays of player names instead of just numbers
  const [roomInfo, setRoomInfo] = useState({ red: [], blue: [], green: [], unassigned: [], total: 0 });

  const [boardChips, setBoardChips] = useState(Array(100).fill(null));
  const [currentTurn, setCurrentTurn] = useState('red');
  const [winner, setWinner] = useState(null);
  const [myTeam, setMyTeam] = useState('');
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    socket.on('room_joined', (roomId) => {
      setCurrentRoom(roomId);
      setAppState('team_select');
    });

    socket.on('room_info', (info) => {
      setRoomInfo(info);
    });

    socket.on('assigned_team', (color) => {
      setMyTeam(color);
      setAppState('game');
    });

    socket.on('game_state', (gameState) => {
      setBoardChips(gameState.board);
      setCurrentTurn(gameState.turn);
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
    if (currentTurn !== myTeam) return alert("It is not your team's turn!");
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

    socket.emit('place_chip', {
      roomId: currentRoom,
      index: index,
      teamColor: myTeam,
      playedCard: selectedCard
    });

    setHand(hand.filter(card => card !== selectedCard));
    setSelectedCard(null);
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

  // ================= LOBBY UI =================
  if (appState === 'lobby') {
    return (
      <div className="min-h-screen bg-green-900 text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-green-800 p-8 rounded-2xl shadow-2xl border-4 border-yellow-500 text-center max-w-md w-full">
          <h1 className="text-5xl font-bold mb-6 tracking-widest text-yellow-400 drop-shadow-md">SEQUENCE</h1>
          <p className="mb-6 text-gray-200">Enter your name and a Room Code to play!</p>
          <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="p-3 text-xl text-black rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-400 text-center font-bold"
              required
              maxLength={15}
            />
            <input
              type="text"
              placeholder="Room Code"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              className="p-3 text-xl text-black rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-400 text-center font-bold"
              required
            />
            <button type="submit" className="bg-yellow-500 text-black font-bold text-xl py-3 rounded-lg hover:bg-yellow-400 shadow-lg">
              Next
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= TEAM SELECT UI =================
  if (appState === 'team_select') {
    return (
      <div className="min-h-screen bg-green-900 text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-green-800 p-8 rounded-2xl shadow-2xl border-4 border-yellow-500 text-center max-w-2xl w-full">
          <h2 className="text-3xl font-bold mb-2 text-yellow-400">Room: {currentRoom}</h2>
          <div className="mb-8">
            <p className="text-gray-200 text-lg">Choose your team</p>
            <p className="text-yellow-200 text-sm font-bold">Total Players Joined: {roomInfo.total} / 12</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Red Team */}
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => handleSelectTeam('red')} 
                disabled={roomInfo.red.length >= 4}
                className={`border-4 text-white font-bold text-lg py-3 rounded-xl shadow-lg transition-transform 
                  ${roomInfo.red.length >= 4 ? 'bg-gray-600 border-gray-800 opacity-50 cursor-not-allowed' : 'bg-red-600 border-red-800 hover:bg-red-500 hover:scale-105'}
                `}
              >
                JOIN RED ({roomInfo.red.length}/4)
              </button>
              <div className="bg-red-950 p-2 rounded text-sm text-red-200 min-h-[60px]">
                {roomInfo.red.length > 0 ? roomInfo.red.join(', ') : 'Waiting for players...'}
              </div>
            </div>

            {/* Blue Team */}
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => handleSelectTeam('blue')} 
                disabled={roomInfo.blue.length >= 4}
                className={`border-4 text-white font-bold text-lg py-3 rounded-xl shadow-lg transition-transform 
                  ${roomInfo.blue.length >= 4 ? 'bg-gray-600 border-gray-800 opacity-50 cursor-not-allowed' : 'bg-blue-600 border-blue-800 hover:bg-blue-500 hover:scale-105'}
                `}
              >
                JOIN BLUE ({roomInfo.blue.length}/4)
              </button>
              <div className="bg-blue-950 p-2 rounded text-sm text-blue-200 min-h-[60px]">
                {roomInfo.blue.length > 0 ? roomInfo.blue.join(', ') : 'Waiting for players...'}
              </div>
            </div>

            {/* Green Team */}
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => handleSelectTeam('green')} 
                disabled={roomInfo.green.length >= 4}
                className={`border-4 text-white font-bold text-lg py-3 rounded-xl shadow-lg transition-transform 
                  ${roomInfo.green.length >= 4 ? 'bg-gray-600 border-gray-800 opacity-50 cursor-not-allowed' : 'bg-emerald-600 border-emerald-900 hover:bg-emerald-500 hover:scale-105'}
                `}
              >
                JOIN GREEN ({roomInfo.green.length}/4)
              </button>
              <div className="bg-emerald-950 p-2 rounded text-sm text-emerald-200 min-h-[60px]">
                {roomInfo.green.length > 0 ? roomInfo.green.join(', ') : 'Waiting for players...'}
              </div>
            </div>
          </div>
          
          {roomInfo.unassigned.length > 0 && (
            <div className="mt-8 pt-4 border-t border-green-700">
              <p className="text-sm text-gray-400">Players deciding: {roomInfo.unassigned.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ================= GAME UI =================
  return (
    <div className="min-h-screen bg-green-800 text-white flex flex-col items-center justify-center p-4 font-sans relative">
      
      {winner && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
          <h1 className={`text-6xl font-bold mb-4 drop-shadow-xl uppercase ${getTeamTextColor(winner)}`}>
            {winner} TEAM WINS!
          </h1>
          <button onClick={() => window.location.reload()} className="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-400">
            Leave Game
          </button>
        </div>
      )}

      {/* Roster Bar */}
      <div className="w-full max-w-4xl bg-green-900 p-2 rounded-lg border border-green-700 mb-4 flex flex-wrap justify-center gap-6 text-xs md:text-sm">
        <div className="text-red-300"><span className="font-bold text-red-500">RED:</span> {roomInfo.red.join(', ') || '-'}</div>
        <div className="text-blue-300"><span className="font-bold text-blue-500">BLUE:</span> {roomInfo.blue.join(', ') || '-'}</div>
        <div className="text-emerald-300"><span className="font-bold text-emerald-500">GREEN:</span> {roomInfo.green.join(', ') || '-'}</div>
      </div>

      <div className="mb-4 text-center w-full max-w-4xl flex flex-col md:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-widest text-yellow-400 drop-shadow-md hidden md:block">SEQUENCE</h1>
        
        <div className="flex gap-4 items-center justify-center bg-green-950 p-3 rounded-lg border-2 border-yellow-500 shadow-md">
          <p className="text-sm md:text-lg">Team: <span className={`font-bold ml-1 ${getTeamTextColor(myTeam)}`}>{myTeam.toUpperCase()}</span></p>
          <div className="w-1 h-6 bg-gray-500 rounded"></div>
          <p className="text-sm md:text-lg">Turn: <span className={`font-bold ml-1 ${getTeamTextColor(currentTurn)}`}>{currentTurn.toUpperCase()}</span></p>
        </div>
      </div>

      <div className="bg-white p-2 rounded-xl shadow-2xl border-4 border-yellow-600 mb-6">
        <div className="grid grid-cols-10 grid-rows-10 gap-1 bg-green-200 p-1 rounded-lg w-full max-w-4xl">
          {BOARD_LAYOUT.map((cardValue, index) => {
            const isCorner = cardValue === 'FREE';
            const chipColor = boardChips[index];
            
            let isMatch = false;
            const isTwoEyed = selectedCard === 'J♦' || selectedCard === 'J♣';
            const isOneEyed = selectedCard === 'J♠' || selectedCard === 'J♥';

            if (!isCorner) {
              if (isTwoEyed && chipColor === null) isMatch = true;
              else if (isOneEyed && chipColor !== null && chipColor !== myTeam) isMatch = true; 
              else if (selectedCard === cardValue && chipColor === null) isMatch = true;
            }
            
            return (
              <div
                key={index}
                onClick={() => !isCorner && handleCellClick(index)}
                className={`
                  relative w-9 h-12 md:w-14 md:h-20 border-2 rounded flex flex-col items-center justify-center bg-white cursor-pointer transition-all shadow-sm
                  ${isCorner ? 'bg-yellow-300 border-yellow-500' : 'hover:bg-gray-100'}
                  ${isMatch ? 'border-yellow-500 bg-yellow-100 scale-105 z-10 shadow-lg' : 'border-gray-300'}
                `}
              >
                {!isCorner ? (
                  <span className={`font-bold text-xs md:text-lg ${getCardColor(cardValue)}`}>{cardValue}</span>
                ) : (
                  <span className="text-yellow-800 font-bold text-[10px] md:text-sm tracking-wider">FREE</span>
                )}
                {chipColor && (
                  <div className={`
                    absolute w-6 h-6 md:w-10 md:h-10 rounded-full border-4 shadow-inner opacity-95 transition-all
                    ${chipColor === 'red' ? 'bg-red-500 border-red-800' : chipColor === 'blue' ? 'bg-blue-500 border-blue-800' : 'bg-emerald-500 border-emerald-900'}
                    ${isMatch && isOneEyed ? 'animate-pulse opacity-50' : ''}
                  `}></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-green-900 p-4 rounded-xl shadow-lg border-2 border-green-700 w-full max-w-4xl">
        <h3 className="text-center text-yellow-400 font-bold mb-3 tracking-widest">YOUR HAND</h3>
        <div className="flex gap-2 md:gap-4 items-center justify-center flex-wrap">
          {hand.map((card, index) => (
            <div 
              key={index} 
              onClick={() => setSelectedCard(card)}
              className={`
                w-12 h-16 md:w-16 md:h-24 bg-white rounded-lg shadow-md flex flex-col items-center justify-center cursor-pointer transition-transform
                ${selectedCard === card ? 'border-4 border-yellow-400 -translate-y-4 scale-110' : 'border-2 border-gray-300 hover:-translate-y-2'}
              `}
            >
              <span className={`font-bold text-lg md:text-2xl ${getCardColor(card)}`}>{card}</span>
              {(card === 'J♦' || card === 'J♣') && <span className="text-[8px] md:text-[10px] font-bold text-green-600 mt-1">WILD</span>}
              {(card === 'J♠' || card === 'J♥') && <span className="text-[8px] md:text-[10px] font-bold text-red-600 mt-1">REMOVE</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
