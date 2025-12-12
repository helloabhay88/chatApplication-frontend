import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { ClipLoader } from 'react-spinners'
import { useParams } from 'react-router-dom';
const ResetPassword = () => {
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [confirmpassword, setConfirmpassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [delayMessage, setDelayMessage] = useState('');
    const [invalidPassword, setInvalidPassword] = useState(false);
    const {id}=useParams();
    const {token}=useParams();

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if(password!==confirmpassword){
                alert("Passwords do not match");
                return;
            }
            const response = await axios.post(`https://chatapplication-api.onrender.com/reset-password/${id}/${token}`, { password })
            if (response.data.message === "password changed successfully") {
                navigate("/")
            }
        } catch (error) {
            console.log(error);
            alert(error.response?.data?.message || "Login failed")
            navigate('/forgot-password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className='bg-gray-900 min-h-screen flex items-center justify-center'>
            <div className='bg-gray-800 flex rounded-2xl shadow-lg max-w-3xl p-5 items-center'>
                <div className='w-80'>
                    <h2 className='font-bold text-2xl text-orange-400'>Change Password</h2>
                    <form className='flex flex-col gap-4 mt-6' onSubmit={handleSubmit}>

                        <input
                            className='p-2 rounded-xl border border-gray-600 bg-gray-900 text-white placeholder-gray-400'
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder='New Password'
                            name='password'
                            required
                        />
                        <div className='relative'>
                            <input
                                className='w-full p-2 rounded-xl border border-gray-600 bg-gray-900 text-white placeholder-gray-400'
                                type={showPassword ? 'text' : 'password'}
                                value={confirmpassword}
                                onChange={(e) => setConfirmpassword(e.target.value)}
                                placeholder='Conform Password'
                                name='confirm password'
                                required
                            />
                            <span
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    cursor: 'pointer',
                                    color: "white"
                                }}
                            >
                                {showPassword ? <FiEyeOff /> : <FiEye />}
                            </span>
                        </div>
                        <button
                            className="bg-orange-500 text-white rounded-xl py-2 px-4 hover:bg-orange-600 duration-200 flex items-center justify-center gap-2"
                            disabled={loading}
                        >
                            <span>Change Password</span>
                            {loading && <ClipLoader size={16} color="#fff" />}
                        </button>
                        {delayMessage && (
                            <p className='mt-2 text-yellow-400 text-sm'>{delayMessage}</p>
                        )}
                    </form>
                </div>
            </div>
        </div>
    )
}
export default ResetPassword
