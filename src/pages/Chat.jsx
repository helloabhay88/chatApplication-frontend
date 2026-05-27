import React, { useEffect, useRef, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { FiMenu } from 'react-icons/fi';
import { SyncLoader } from 'react-spinners';

const Chat = ({ socket }) => {
  // State for chat functionality
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [receiverId, setReceiverId] = useState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userId = window.localStorage.getItem('userId');
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // State for pagination and scrolling
  const [page, setPage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const messagesLimit = 20; // Define how many messages to fetch at a time
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const loadingRef = useRef(false);
  const scrollHeightRef = useRef(0);
  const [isFetchingInitialMessages, setIsFetchingInitialMessages] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  


  // Refs for DOM elements
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null); // Ref to hold the AbortController

  // IntersectionObserver to detect when the user scrolls to the top of the chat
  const observer = useRef(null);
  const topMessageRef = useRef(null);

  // The new base URL for the deployed backend
  const BASE_URL = "https://chatapplication-api.onrender.com";
  //const BASE_URL = "http://localhost:3000";

  // --- Utility Effects ---
  // A heartbeat interval to keep the user's socket connection alive and signal they are active
  useEffect(() => {
    const interval = setInterval(() => {
      if (socket && userId) {
        socket.emit('heartbeat', userId);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [socket, userId]);

  // Handle browser tab visibility to emit online/offline events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        socket.emit('user-online', userId);
      } else {
        socket.emit('user-offline', userId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (document.visibilityState === 'visible') {
      socket.emit('user-online', userId);
    }
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket.emit('user-offline', userId);
    };
  }, [socket, userId]);

  // Set up listeners for typing indicators
  useEffect(() => {
    if (!socket || !userId) return;
    const handleUserTyping = ({ senderId }) => {
      //console.log("User typing event received", senderId, receiverId);
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

  // Reset typing indicator when switching to a new user
  useEffect(() => {
    setIsTyping(false);
  }, [receiverId]);

  // Send a 'join' event to the server when the user connects
  useEffect(() => {
    if (socket && userId) {
      socket.emit('join', userId);
    }
  }, [socket, userId]);

  // Listen for the list of online users from the server
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
  
  // Custom function to scroll to the bottom of the chat container
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  };
  
  // --- Real-Time Messaging and Status Updates ---
  // The corrected useEffect to handle incoming messages in real-time.
  useEffect(() => {
    if (!socket || !userId) return;

    // CORRECTED LOGIC: Only add a new message if it's from the other person.
    const handleNewMessage = (newMessage) => {
      //console.log("New message received:", newMessage);
      if (newMessage.sender === receiverId) {
        setMessages(prevMessages => [...prevMessages, newMessage]);
        setShouldScrollToBottom(true);
      }
    };
    
    // This updates the 'seen' status of a sent message in real-time.
    const handleMessageSeen = ({ messageId }) => {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === messageId ? { ...msg, seen: true } : msg
        )
      );
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageSeen', handleMessageSeen);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageSeen', handleMessageSeen);
    };
  }, [socket, userId, receiverId]);

  // --- Message Fetching & Pagination Logic ---

  // Function to fetch messages from the backend with pagination
  const fetchMessages = useCallback(async (currentPage, isInitialFetch = false) => {
    if (loadingRef.current || !selectedUser) return;
    
    if (!isInitialFetch && messagesContainerRef.current) {
        scrollHeightRef.current = messagesContainerRef.current.scrollHeight;
    }
    
    loadingRef.current = true;

    try {
      const skip = currentPage * messagesLimit;
      const res = await axios.get(
        `${BASE_URL}/chat/message/read/${selectedUser._id}?skip=${skip}&limit=${messagesLimit}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
          },
          // Pass the abort signal to the request
          signal: abortControllerRef.current.signal,
        }
      );
      
      const newMessages = res.data;
      
      // Update hasMoreMessages based on the number of messages returned
      if (newMessages.length < messagesLimit) {
        setHasMoreMessages(false);
      } else {
        setHasMoreMessages(true);
      }

      // For initial fetch, replace messages. For pagination, prepend.
      if (isInitialFetch) {
        setMessages(newMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
        setInitialLoadComplete(true);
      } else {
        setMessages(prev => {
          const combinedMessages = [...newMessages, ...prev];
          return combinedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
      }
      
    } catch (error) {
      // Ignore abort errors which happen when switching chats
      if (axios.isCancel(error) || error.name === 'AbortError') {
        console.log('Request aborted due to new user selection');
      } else {
        console.error('Error fetching messages:', error);
        setHasMoreMessages(false);
      }
    } finally {
      loadingRef.current = false;
      if (isInitialFetch) {
        setIsFetchingInitialMessages(false);
      }
    }
  }, [selectedUser, messagesLimit]);

  // Effect to handle user selection and initial message fetch
  useEffect(() => {
    if (selectedUser) {
      // Abort any ongoing request before starting a new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Clear messages and reset state immediately on new user selection
      setMessages([]);
      setPage(0);
      setHasMoreMessages(true);
      setInitialLoadComplete(false);
      setIsFetchingInitialMessages(true);
      
      // Fetch messages for the newly selected user
      fetchMessages(0, true);
    }

    // Cleanup function to abort the request if the component unmounts or selectedUser changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedUser, fetchMessages]);

  // Effect to perform initial scroll to bottom after messages are loaded for a new chat
  useEffect(() => {
    if (initialLoadComplete) {
      scrollToBottom();
    }
  }, [initialLoadComplete]);

  // Effect to observe the top of the chat window for pagination
  useEffect(() => {
    if (!initialLoadComplete || !topMessageRef.current || !hasMoreMessages) {
      return;
    }

    if (observer.current) {
        observer.current.disconnect();
    }
    
    observer.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingRef.current && hasMoreMessages) {
        setPage(prevPage => prevPage + 1);
      }
    }, {
      root: messagesContainerRef.current,
      threshold: 0.1,
    });
    
    observer.current.observe(topMessageRef.current);
    
    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [initialLoadComplete, hasMoreMessages, messages.length]);

  // Effect to fetch the next page of messages when the page state changes
  useEffect(() => {
    if (page > 0 && hasMoreMessages) {
      fetchMessages(page);
    }
  }, [page, fetchMessages, hasMoreMessages]);

  // Use a different effect for scrolling to keep scroll position during pagination
  useEffect(() => {
      if (messagesContainerRef.current && scrollHeightRef.current > 0) {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          messagesContainerRef.current.scrollTop += newScrollHeight - scrollHeightRef.current;
          scrollHeightRef.current = 0; // Reset after use
      }
  }, [messages]);
  
  // New Effect to handle scrolling to bottom when a new message is sent or received
  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom();
      setShouldScrollToBottom(false);
    }
  }, [shouldScrollToBottom]);

  // Clean up typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);
  
  // Mark unseen messages as seen when conversation is open
  useEffect(() => {
    if (!receiverId) return;
    const unseenMessages = messages.filter(m => m.sender === receiverId && !m.seen);
    
    if (unseenMessages.length > 0) {
      unseenMessages.forEach(m => {
        socket.emit('messageSeen', { messageId: m._id, senderId: receiverId });
      });
      
      setMessages(prevMessages => 
        prevMessages.map(m => 
          m.sender === receiverId && !m.seen ? { ...m, seen: true } : m
        )
      );
    }
  }, [receiverId, messages, socket]);

  // Send message handler
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !receiverId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('stopTyping', { senderId: userId, receiverId });

    // Capture data and clear input immediately
    const tempId = Date.now();
    const messageContent = message;
    setMessage('');
    
    const tempMessage = {
      _id: tempId,
      sender: userId,
      content: messageContent,
      createdAt: new Date(),
      pending: true
    };
    
    // Add the temporary message to the UI
    setMessages(prev => [...prev, tempMessage]);
    setShouldScrollToBottom(true);
    
    // Fire the API request in the background concurrently
    axios.post(
      `${BASE_URL}/chat/message/send/${receiverId}`,
      { content: messageContent },
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
        }
      }
    )
    .then((res) => {
      setMessages(prev =>
        prev.map(msg => msg._id === tempId ? res.data : msg)
      );
    })
    .catch((error) => {
      console.error('Error sending message:', error);
      setMessages(prev =>
        prev.map(msg => msg._id === tempId ? { ...msg, pending: false, error: true } : msg)
      );
    });
  };

  // Typing handler
  const handleTyping = () => {
    if (!socket || !userId || !receiverId) return;
    socket.emit('typing', { senderId: userId, receiverId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { senderId: userId, receiverId });
    }, 1500);
  };
  
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
            setSidebarOpen(false);
          }}
          setMessages={setMessages}
          setReceiverId={setReceiverId}
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
          isFetchingInitialMessages ? (
            <div className='flex-1 flex items-center justify-center bg-gray-900'>
              <SyncLoader color="#3B82F6" size={8} />
            </div>
          ) : (
            <>
              {/* Desktop Header */}
              <div className='hidden md:block p-4 border-b border-gray-700 bg-gray-800 rounded-b-lg shadow-md'>
                <h2 className='text-lg sm:text-xl font-semibold'>
                  Chat with {selectedUser.name}
                  <span className={`ml-2 text-sm ${isReceiverOnline ? 'text-green-400' : 'text-gray-400'}`}>
                    ● {isReceiverOnline ? 'online' : 'offline'}
                  </span>
                </h2>
              </div>

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className='flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 flex flex-col bg-gray-900 min-h-0 pt-16 md:pt-0 pb-4'
              >
                {hasMoreMessages && messages.length > 0 && (
                  <div ref={topMessageRef} className="flex justify-center my-2">
                    <SyncLoader color="#3B82F6" size={8} />
                  </div>
                )}
                {messages.map((msg, index) => (
                  <div
                    key={msg._id}
                    className={`p-3 rounded-lg max-w-[80%] text-sm sm:text-base shadow-md
                      ${msg.sender === userId
                        ? 'bg-blue-600 self-end text-white'
                        : 'bg-gray-700 self-start text-white'
                      }`}
                  >
                    <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                    {msg.pending && <span className="text-gray-400 text-sm"> sending...</span>}
                    {msg.sender === userId && msg.seen && (
                      <span className="text-xs text-gray-300 mt-1 block text-right">
                        ✓ seen
                      </span>
                    )}
                    {msg.sender === userId && msg.error && (
                      <span className="text-xs text-red-400 mt-1 block text-right">
                        Failed to send
                      </span>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className='flex-shrink-0 p-3 sm:p-4 border-t border-gray-700 bg-gray-800 shadow-lg'>
                {isTyping && (
                  <div className="text-sm text-gray-400 mb-2 transition-opacity duration-300">
                    <span className="animate-pulse">Typing...</span>
                  </div>
                )}
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
          )
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
