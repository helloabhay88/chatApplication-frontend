import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { ClipLoader } from 'react-spinners'
const Register = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [delayMessage, setDelayMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault()
    let delay;
    const formData = new FormData()
    formData.append('email', email)
    formData.append('password', password)
    formData.append('name', name)
    if(file){
          formData.append('image', file)
    }

    try {
      setLoading(true)
      setDelayMessage('')
       delay=setTimeout(()=>{
        setDelayMessage('Server is waking up... This may take up to a minute.')
      }, 3000)
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/chat/user/register`, formData)
      clearTimeout(delay)
      setDelayMessage('')
      if (response.data.message === "success") {
        navigate("/")
      }
    } catch (error) {
      alert(error.response?.data?.message || "Registration failed")
      clearTimeout(delay)
      setDelayMessage('')
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className='bg-gray-900 min-h-screen flex items-center justify-center'>
      <div className='bg-gray-800 flex rounded-2xl shadow-lg max-w-3xl p-5 items-center'>
        <div className='md:w-1/2 px-8'>
          <h2 className='font-bold text-2xl text-orange-400'>Sign Up</h2>
          <form className='flex flex-col gap-4 mt-6' onSubmit={handleSubmit}>
            
            <input
              className='p-2 rounded-xl border border-gray-600 bg-gray-900 text-white placeholder-gray-400'
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder='Email'
              name='email'
              required
            />
            <input
              className='p-2 rounded-xl border border-gray-600 bg-gray-900 text-white placeholder-gray-400'
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder='Name'
              name='name'
              required
            />
            <div className='relative'>
              <input
                className='p-2 rounded-xl border border-gray-600 bg-gray-900 text-white placeholder-gray-400 w-full'
                type={showPassword? 'text' : 'password'}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Password'
                name='password'
                required
              />
              {/* <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                fill="currentColor"
                className="bi bi-eye absolute top-1/2 right-3 -translate-y-1/2 text-gray-400"
                viewBox="0 0 16 16">
                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 
                  8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 
                  4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 
                  2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 
                  1.12-1.465 1.755C11.879 11.332 10.119 12.5 
                  8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 
                  2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 
                  0 3.5 3.5 0 0 1-7 0" />
              </svg> */}
               <span
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        cursor: 'pointer',
                        color:"white"
                      }}
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </span>
            </div>
            <input
              onChange={(e) => setFile(e.target.files[0])}
              className='rounded-xl border border-gray-600 bg-gray-900 text-white p-2 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file-border-0 file:text-sm file:font-semibold file:bg-orange-400 file:text-white hover:file:scale-105 file:duration-200'
              type="file"
            />
            <button
              className="bg-orange-500 text-white rounded-xl py-2 px-4 hover:bg-orange-600 duration-200 flex items-center justify-center gap-2"
              disabled={loading}
            >
              <span>Sign Up</span>
              {loading && <ClipLoader size={16} color="#fff" />}
            </button>
            {delayMessage && (
              <p className='mt-2 text-yellow-400 text-sm'>{delayMessage}</p>
            )}
          </form>

          <div className='mt-8 grid grid-cols-3 items-center text-orange-400'>
            <hr className='border-orange-400' />
            <p className='text-center text-sm'>OR</p>
            <hr className='border-orange-400' />
          </div>

          <div className='mt-4 text-sm flex justify-between items-center text-gray-300'>
            <p>Already have an account?</p>
            <Link
              to="/"
              className='py-2 px-4 border border-gray-600 text-white rounded-xl hover:bg-gray-700 duration-200'
            >
              Login
            </Link>
          </div>
        </div>

        <div className='md:block hidden w-1/2'>
          <img
            className="rounded-2xl"
            src="https://cdn.pixabay.com/photo/2024/09/11/06/02/girl-9038822_1280.jpg"
            alt="Register visual"
          />
        </div>
      </div>
    </div>
  )
}

export default Register
