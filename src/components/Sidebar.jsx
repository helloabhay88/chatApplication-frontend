import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoSettingsOutline } from "react-icons/io5";
import SettingsModal from './SettingsModal';

const Sidebar = ({ socket, onSelectUser, setReceiverId, setMessages, activeReceiverId }) => {
  const [users, setUsers] = useState([])
  const [filterUsers, setFilterUsers] = useState([])
  const navigate = useNavigate()
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/chat/user/me`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
          }
        });
        if (response.data.message === 'success') {
          setCurrentUser(response.data.user);
        }
      } catch (err) {
        console.error("Error fetching current user info:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleOnlineUsers = (userIds) => {
      setOnlineUsers(userIds);
    };

    const handleNewMessage = (newMessage) => {
      // If the message is not from the currently active user, increment unread count
      if (newMessage.sender !== activeReceiverId) {
        setUsers(prev => prev.map(u => 
          u._id === newMessage.sender ? { ...u, unreadCount: (u.unreadCount || 0) + 1 } : u
        ));
        setFilterUsers(prev => prev.map(u => 
          u._id === newMessage.sender ? { ...u, unreadCount: (u.unreadCount || 0) + 1 } : u
        ));
      }
    };

    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, activeReceiverId]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const users = await axios.get(`${import.meta.env.VITE_API_URL}/chat/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
          }
        })
        setUsers(users.data.users)
        setFilterUsers(users.data.users)
      } catch (error) {
        navigate('/')
        console.log(error)
      }
    }

    fetchUser()
  }, [])

  const handleLogout = () => {
    if (socket) {
      socket.disconnect(); // Disconnect socket so backend knows user left
    }
    window.localStorage.removeItem('chat-token')
    window.localStorage.removeItem('userId')
    window.location.href = '/';
  }

  const handleUserClick = (user) => {
    // Clear previous messages and set the new receiver
    setMessages([]);
    setReceiverId(user._id);
    onSelectUser(user);
    
    // Reset unread count locally when the chat is opened
    setUsers(prev => prev.map(u => u._id === user._id ? { ...u, unreadCount: 0 } : u));
    setFilterUsers(prev => prev.map(u => u._id === user._id ? { ...u, unreadCount: 0 } : u));
  }

  const handlefilter = (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = users.filter((usr) =>
      usr.name.toLowerCase().includes(search)
    );
    setFilterUsers(filtered);
  };

  return (
    <div className='flex flex-col h-full max-h-full p-4 bg-gray-800 text-gray-200'>
      {/* Search Input - Fixed at top */}
      <div className='flex items-center gap-2 mb-4'>
        <input
          type="text"
          placeholder='Search'
          onChange={handlefilter}
          className='p-2 w-full rounded-xl border border-gray-600 bg-gray-700 text-white placeholder-gray-400'
        />
        <IoSettingsOutline 
          className='text-gray-400 cursor-pointer hover:text-white transition-colors duration-200' 
          size={22}
          onClick={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* User List - Scrollable middle section */}
      <div className='flex-1 min-h-0 overflow-y-auto mb-4'>
        {filterUsers.length > 0 ? (
          <div className='space-y-4'>
  
            {filterUsers.map(user => (
              <div
                key={user._id}
                className='flex items-center space-x-3 cursor-pointer hover:bg-gray-700 p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95'
                onClick={() => handleUserClick(user)}
              >
                {user.image && user.image.trim() !== '' ? (
                  <img
                    src={`https://res.cloudinary.com/dqp7w0fvl/image/upload/v1752851774/${user.image}`}
                    width="40"
                    height="40"
                    className='rounded-full object-cover w-10 h-10'
                    alt={user.email}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white flex-shrink-0">
                    <span className="text-lg font-bold">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className='flex flex-col flex-1 min-w-0'>
                  <div className="flex justify-between items-center w-full">
                    <span className='text-gray-200 truncate pr-2'>{user.name}</span>
                    {user.unreadCount > 0 && (
                      <span className='bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0'>
                        {user.unreadCount}
                      </span>
                    )}
                  </div>
                  {onlineUsers.includes(user._id) && (
                    <span className='text-green-400 text-sm'>● online</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className='text-gray-400'>No users</p>
        )}
      </div>
        
      {/* User Profile Card - Fixed at bottom */}
      <div className='flex-shrink-0 flex items-center justify-between p-3 bg-gray-900/50 rounded-xl border border-gray-700/50 mt-auto'>
        <div className='flex items-center gap-3 min-w-0'>
          {currentUser?.image ? (
            <img
              src={`https://res.cloudinary.com/dqp7w0fvl/image/upload/v1752851774/${currentUser.image}`}
              className='w-10 h-10 rounded-full object-cover border border-gray-600 flex-shrink-0'
              alt={currentUser.name}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0 border border-gray-600">
              {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div className='flex flex-col min-w-0'>
            <span className='text-sm font-semibold text-gray-200 truncate'>{currentUser?.name || 'Loading...'}</span>
            <span className='text-xs text-gray-400 truncate'>{currentUser?.email}</span>
          </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        handleLogout={handleLogout}
        onProfileUpdate={(updatedUser) => setCurrentUser(updatedUser)}
        currentUser={currentUser}
      />
    </div>
    
  )
}

export default Sidebar;
