import React, { useEffect, useId, useRef, useState } from 'react';
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

  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);

  // Debug log component state
  console.log('Chat component state:', {
    socket: !!socket,
    userId,
    receiverId,
    isTyping
  });

  // Set up typing event listeners
  useEffect(() => {
    if (!socket || !userId) {
      console.log('Socket or userId not available, skipping listener setup');
      return;
    }

    console.log('Setting up typing listeners');

    const handleUserTyping = ({ senderId }) => {
      if (senderId === receiverId) {
        setIsTyping(true);
      }
    };

    const handleUserStopTyping = ({ senderId }) => {
      if (senderId === receiverId) {
        setIsTyping(false);
      }
    };

    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);

    return () => {
      socket.off('userTyping', handleUserTyping);
      socket.off('userStopTyping', handleUserStopTyping);
    };
  }, [socket, userId, receiverId]); // Include receiverId in dependencies

  // Reset typing state when switching users
  useEffect(() => {
    setIsTyping(false);
  }, [receiverId]);

  // Join the socket room when the component mounts or userId/socket changes
  useEffect(() => {
    if (socket && userId) {
      socket.emit('join', userId);
      console.log('Joined socket room with userId:', userId);
    }
  }, [socket, userId]);

  // Listen for new messages from the socket
  useEffect(() => {
    const handleNewMessage = (message) => {
      // Only add message if it's for the currently selected user or from the current user
      if (message.sender === receiverId || message.sender === userId) {
        setMessages((state) => [...state, { sender: message.sender, content: message.content }]);
      }
    };
    socket.on('newMessage', handleNewMessage);

    // Clean up the event listener when the component unmounts or dependencies change
    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, receiverId, userId]); // Added userId to dependencies for correct filtering

  // Scroll to the latest message whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages,isTyping]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Handler for sending messages
  const handleSendMessage = async (e) => {
    e.preventDefault(); // Prevent default form submission
    if (!message.trim() || !receiverId) return; // Don't send empty messages or if no receiver is selected

    // Clear typing timeout and emit stop typing when sending
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (socket && userId && receiverId) {
      socket.emit('stopTyping', { senderId: userId, receiverId });
    }

    // Add the sent message to the local state immediately for optimistic UI update
    setMessages(prev => [...prev, { content: message, sender: userId }]);
    setMessage(''); // Clear the input field

    try {
      // Make an API call to send the message
      await axios.post(
        'https://chatapplication-api.onrender.com/chat/message/send/' + receiverId,
        { content: message },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}` // Include auth token
          }
        }
      );
    } catch (error) {
      console.error('Error sending message:', error); // Log any errors
      // Optionally, revert the optimistic update or show an error message to the user
    }
  };

  const handleTyping = () => {
    if (!socket || !userId || !receiverId) {
      console.log('Cannot emit typing - missing socket, userId, or receiverId');
      return;
    }

    console.log('Emitting typing event:', { senderId: userId, receiverId });
    socket.emit('typing', { senderId: userId, receiverId });
    
    // Stop typing after 1.5 seconds of no typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      console.log('Emitting stopTyping event:', { senderId: userId, receiverId });
      socket.emit('stopTyping', { senderId: userId, receiverId });
    }, 1500);
  };

  return (
    <div className='min-h-screen flex flex-col md:flex-row bg-gray-900 text-gray-200'>

      {/* Mobile Header with Hamburger - FIXED at the top for small screens */}
      <div className='md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 rounded-b-lg shadow-lg'>
        {/* Toggle sidebarOpen state on click */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className='text-white p-2 rounded-full hover:bg-gray-700 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500'>
          <FiMenu size={24} />
        </button>
        <h2 className='text-lg font-semibold truncate max-w-[70%]'>
          {selectedUser ? `Chat with ${selectedUser.name}` : 'Chat'}
        </h2>
        {/* Placeholder to balance the hamburger icon on the left */}
        <div className="w-8"></div>
      </div>

      {/* Sidebar - Fixed for mobile, static for desktop */}
      <div className={`
        fixed md:static top-0 left-0 h-full w-3/4 sm:w-1/2 md:w-1/3 bg-gray-800 border-r border-gray-700 z-40
        transform transition-transform duration-300 ease-in-out rounded-r-lg shadow-xl
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <Sidebar
          onSelectUser={(user) => {
            setSelectedUser(user);
            setReceiverId(user._id);
            // Removed setMessages([]) from here. Messages will now be loaded by Sidebar's handleUserClick.
            setSidebarOpen(false); // Close sidebar on user selection for mobile
          }}
          setReceiverId={setReceiverId} // Pass setReceiverId to Sidebar
          setMessages={setMessages}     // Pass setMessages to Sidebar
        />
      </div>

      {/* Overlay for mobile sidebar - closes sidebar when clicked */}
      {sidebarOpen && (
        <div
          className='fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden'
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Chat Area - main content section */}
      <div className='w-full md:w-2/3 flex flex-col h-screen relative'>

        {selectedUser ? (
          <>
            {/* Desktop Header - visible only on desktop */}
            <div className='hidden md:block p-4 border-b border-gray-700 bg-gray-800 rounded-b-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold'>Chat with {selectedUser.name}</h2>
            </div>

            {/* Chat Messages Display Area */}
            <div className='flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 flex flex-col bg-gray-900 min-h-0
                pt-16 md:pt-0 pb-4'>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg max-w-[80%] text-sm sm:text-base shadow-md
                  ${msg.sender === userId
                      ? 'bg-blue-600 self-end text-white'
                      : 'bg-gray-700 self-start text-white'
                    }`}
                >
                  <p>{msg.content}</p>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="self-start max-w-[80%] p-3 rounded-lg bg-gray-700 text-white shadow-md">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm italic">{selectedUser.name} is typing</span>
                    <div className="flex space-x-1 ml-2">
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Form - positioned relative to chat container */}
            <div className='flex-shrink-0 p-3 sm:p-4 border-t border-gray-700 bg-gray-800 shadow-lg'>
              <form onSubmit={handleSendMessage}>
                <div className='flex items-center gap-3 w-full max-w-4xl mx-auto'>
                  <input
                    type='text'
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
                    placeholder='Type your message...'
                    className='flex-1 p-3 rounded-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200'
                  />
                  <button
                    type='submit'
                    disabled={!message.trim()}
                    className='bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0'
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>

          </>
        ) : (
          // Message displayed when no user is selected
          <div className='flex-1 flex items-center justify-center text-gray-400 bg-gray-900
                          pt-16 md:pt-0'>
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