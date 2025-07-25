import React, { useEffect, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { FiMenu } from 'react-icons/fi';

const Chat = ({ socket }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [receiverId, setReceiverId] = useState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userId = window.localStorage.getItem('userId');
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]); // ✅ added

  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log("page is visible")
      socket.emit('user-online', userId);
    } else {
      console.log("page is hidden")
      socket.emit('user-offline', userId);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Send status when component mounts (page loaded)
  if (document.visibilityState === 'visible') {
    socket.emit('user-online', userId);
  }

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    socket.emit('user-offline', userId); // optional, user leaving page/component
  };
}, [socket, userId]);

  // Listen for typing events
  useEffect(() => {
    if (!socket || !userId) return;

    const handleUserTyping = ({ senderId }) => {
      if (senderId === receiverId) setIsTyping(true);
    };

    const handleUserStopTyping = ({ senderId }) => {
      if (senderId === receiverId) setIsTyping(false);
    };

    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);

    return () => {
      socket.off('userTyping', handleUserTyping);
      socket.off('userStopTyping', handleUserStopTyping);
    };
  }, [socket, userId, receiverId]);

  useEffect(() => {
    setIsTyping(false);
  }, [receiverId]);

  // Join room on mount
  useEffect(() => {
    if (socket && userId) {
      socket.emit('join', userId);
    }
  }, [socket, userId]);

  // ✅ Listen for onlineUsers event
  useEffect(() => {
    if (!socket) return;

    const handleOnlineUsers = (userIds) => {
      setOnlineUsers(userIds);
    };

    socket.on('onlineUsers', handleOnlineUsers);

    return () => {
      socket.off('onlineUsers', handleOnlineUsers);
    };
  }, [socket]);

  // Listen for messages
  useEffect(() => {
    const handleNewMessage = (message) => {
      if (message.sender === receiverId || message.sender === userId) {
        setMessages((state) => [...state, { sender: message.sender, content: message.content }]);
      }
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, receiverId, userId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !receiverId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('stopTyping', { senderId: userId, receiverId });

    setMessages(prev => [...prev, { content: message, sender: userId }]);
    setMessage('');

    try {
      await axios.post(
        'https://chatapplication-api.onrender.com/chat/message/send/' + receiverId,
        { content: message },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
          }
        }
      );
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = () => {
    if (!socket || !userId || !receiverId) return;

    socket.emit('typing', { senderId: userId, receiverId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { senderId: userId, receiverId });
    }, 1500);
  };

  // ✅ Check if selected user is online
  const isReceiverOnline = selectedUser && onlineUsers.includes(selectedUser._id);

  return (
    <div className='min-h-screen flex flex-col md:flex-row bg-gray-900 text-gray-200'>

      {/* Mobile Header */}
      <div className='md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 rounded-b-lg shadow-lg'>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className='text-white p-2 rounded-full hover:bg-gray-700'>
          <FiMenu size={24} />
        </button>
        <h2 className='text-lg font-semibold truncate max-w-[70%]'>
          {selectedUser ? (
            <>
              {selectedUser.name}
              <span className={`ml-2 text-sm ${isReceiverOnline ? 'text-green-400' : 'text-gray-400'}`}>
                ● {isReceiverOnline ? 'Online' : 'Offline'}
              </span>
            </>
          ) : 'Chat'}
        </h2>
        <div className="w-8" />
      </div>

      {/* Sidebar */}
      <div className={`
        fixed md:static top-0 left-0 h-full w-3/4 sm:w-1/2 md:w-1/3 bg-gray-800 border-r border-gray-700 z-40
        transform transition-transform duration-300 ease-in-out rounded-r-lg shadow-xl
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <Sidebar
          socket={socket}
          onSelectUser={(user) => {
            setSelectedUser(user);
            setReceiverId(user._id);
            setSidebarOpen(false);
          }}
          setReceiverId={setReceiverId}
          setMessages={setMessages}
        />
      </div>

      {sidebarOpen && (
        <div
          className='fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden'
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Chat Area */}
      <div className='w-full md:w-2/3 flex flex-col h-screen relative'>
        {selectedUser ? (
          <>
            {/* Desktop Header */}
            <div className='hidden md:block p-4 border-b border-gray-700 bg-gray-800 rounded-b-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold'>
                Chat with {selectedUser.name}
                <span className={`ml-2 text-sm ${isReceiverOnline ? 'text-green-400' : 'text-gray-400'}`}>
                  ● {isReceiverOnline ? 'Online' : 'Offline'}
                </span>
              </h2>
            </div>

            {/* Messages */}
            <div className='flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 flex flex-col bg-gray-900 min-h-0 pt-16 md:pt-0 pb-4'>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg max-w-[80%] text-sm sm:text-base shadow-md
                    ${msg.sender === userId
                      ? 'bg-blue-600 self-end text-white'
                      : 'bg-gray-700 self-start text-white'
                    }`}
                >
                  <p className="break-words whitespace-pre-wrap">{msg.content}</p>

                </div>
              ))}

              {isTyping && (
                <div className="self-start max-w-[80%] p-3 rounded-lg bg-gray-700 text-white shadow-md">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm italic">typing</span>
                    <div className="flex space-x-1 ml-2">
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className='flex-shrink-0 p-3 sm:p-4 border-t border-gray-700 bg-gray-800 shadow-lg'>
              <form onSubmit={handleSendMessage}>
                <div className='flex items-center gap-3 w-full max-w-4xl mx-auto'>
                  <input
                    type='text'
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
                    placeholder='Type your message...'
                    className='flex-1 p-3 rounded-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  />
                  <button
                    type='submit'
                    disabled={!message.trim()}
                    className='bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white px-6 py-3 rounded-full'
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className='flex-1 flex items-center justify-center text-gray-400 bg-gray-900 pt-16 md:pt-0'>
            <div className='text-center px-4'>
              <p className='text-xl sm:text-2xl font-semibold mb-2'>Select a user to start chatting!</p>
              <p className='text-sm sm:text-base opacity-75'>Choose a contact from the sidebar to begin your conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
