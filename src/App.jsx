import { useState } from 'react'
import {BrowserRouter,Routes,Route} from 'react-router-dom'
import Home from './pages/Home'
import Register from './components/Register'
import Chat from './pages/Chat'
import io from 'socket.io-client'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

//const socket=io.connect('https://chatapplication-api.onrender.com/')
const socket=io.connect('http://localhost:3000/')
function App() {

  return (
   <BrowserRouter>
    <Routes>
      <Route path='/' element={<Home/>}></Route>
      <Route path='/register' element={<Register/>}></Route>
      <Route path='/forgot-password' element={<ForgotPassword/>}></Route>
      <Route path='/reset-password/:id/:token' element={<ResetPassword/>}></Route>
      <Route path='/chat' element={<Chat socket={socket}/>}></Route>
    </Routes>
   </BrowserRouter>
  )
}

export default App
