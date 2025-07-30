import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Sidebar = ({socket, onSelectUser, setReceiverId, setMessages }) => {
  const [users, setUsers] = useState([])
  const [filterUsers,setFilterUsers]=useState([])
  const navigate = useNavigate()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const users = await axios.get('https://chatapplication-api.onrender.com/chat/users', {
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

  const handleUserClick = async (user) => {
    try {
      const response = await axios.get('https://chatapplication-api.onrender.com/chat/message/read/' + user._id, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('chat-token')}`
        }
      })
      setMessages(response.data)
    } catch (error) {
      console.log(error)
      setMessages([])
    }
    onSelectUser(user)
    setReceiverId(user._id)
  }
  const handlefilter = (e) => {
  const search = e.target.value.toLowerCase();
  const filtered = users.filter((usr) =>
    usr.name.toLowerCase().includes(search)
  );
  setFilterUsers(filtered);
};


  return (
    <div className='flex flex-col h-screen p-4 bg-gray-800 text-gray-200 justify-between'>
      {/* Search and User List */}
      <div className='flex-grow overflow-y-auto'>
        <input
          type="text"
          placeholder='Search'
          onChange={handlefilter}
          className='p-2 mb-4 w-full rounded-xl border border-gray-600 bg-gray-700 text-white placeholder-gray-400'
        />
        {filterUsers.length > 0 ? (
          <div className='space-y-4'>
            {filterUsers.map(user => (
              <div
                key={user._id}
                className='flex items-center space-x-3 cursor-pointer hover:bg-gray-700 p-2 rounded-lg'
                onClick={() => handleUserClick(user)}
              >
                <img
                  src={`https://res.cloudinary.com/dqp7w0fvl/image/upload/v1752851774/${user.image}`}
                  
                  width="40"
                  height="40"
                  className='rounded-full object-cover'
                  alt={user.email}
                />
                <span className='text-gray-200'>{user.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className='text-gray-400'>No users</p>
        )}
      </div>

      {/* Logout Button */}
      <div className='mt-4'>
        <button
          onClick={handleLogout}
          className='w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600'
        >
          Logout
        </button>
      </div>
    </div>
  )
}

export default Sidebar
 
