import { BrowserRouter, Route, Routes } from "react-router-dom";
import './App.css';
import { Web3Provider } from './components/Web3Provider';
import Home from './pages/home';
import { ToastContainer } from "react-toastify";

function App() {
  return <BrowserRouter>
    <Web3Provider>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
      <ToastContainer />
    </Web3Provider>
  </BrowserRouter>
}

export default App;
