import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { ClipLoader } from 'react-spinners'
const ForgotPassword = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [delayMessage, setDelayMessage] = useState('');
  const [invalidPassword, setInvalidPassword]=useState(false);
  const [linkmessage,setLinkmessage]=useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault()
    let delay;
    try {
      setLoading(true)
      setDelayMessage('')
      delay = setTimeout(() => {
        setDelayMessage('Server is waking up... This may take up to a minute.')
      }, 3000)
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/forgot-password/forgot-verify`, { email})
      setLinkmessage(true);
      clearTimeout(delay)
      setDelayMessage('')
    } catch (error) {
            setLinkmessage(true);

      //alert(error.response?.data?.message || "Login failed")
      setInvalidPassword(true);
      clearTimeout(delay)
      setDelayMessage('')
      
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='bg-gray-900 min-h-screen flex items-center justify-center'>
      <div className='bg-gray-800 flex rounded-2xl shadow-lg max-w-3xl p-5 items-center'>
        <div className='w-80'>
          <h2 className='font-bold text-2xl text-orange-400'>Forgot Password</h2>
          <form className='flex flex-col gap-4 mt-6' onSubmit={handleSubmit}>
            <input
              className='p-2 rounded-xl border border-gray-600 bg-gray-900 text-white placeholder-gray-400'
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='Email'
              name='email'
              required
            />
           
            <button
              className="bg-orange-500 text-white rounded-xl py-2 px-4 hover:bg-orange-600 duration-200 flex items-center justify-center gap-2"
              disabled={loading}
            >
              <span>Send Link</span>
              {loading && <ClipLoader size={16} color="#fff" />}
            </button>
           {linkmessage && <p className='text-green-400'>If the email exists in our system, a password reset link has been sent. This link is valid for 10 minutes. Please check your inbox and spam folder.</p>}
            {delayMessage && (
              <p className='mt-2 text-yellow-400 text-sm'>{delayMessage}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
export default ForgotPassword
