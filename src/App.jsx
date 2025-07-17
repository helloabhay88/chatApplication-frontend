import { useState } from 'react'
import {BrowserRouter,Routes,Route} from 'react-router-dom'
import Home from './pages/Home'
import Register from './components/Register'
import Chat from './pages/Chat'
import io from 'socket.io-client'

const socket=io.connect('https://chatapplication-api.onrender.com/')
function App() {

  return (
   <BrowserRouter>
    <Routes>
      <Route path='/' element={<Home/>}></Route>
      <Route path='/register' element={<Register/>}></Route>
      <Route path='/chat' element={<Chat socket={socket}/>}></Route>
    </Routes>
   </BrowserRouter>
  )
}

export default App
