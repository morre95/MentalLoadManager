import './App.css'

function App() {

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      {/* Test Card */}
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden md:max-w-2xl border border-gray-100 transition-transform hover:scale-105 duration-300">
        <div className="md:flex">
          <div className="p-8">
            <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">
              Tailwind CSS Test
            </div>
            <h1 className="block mt-1 text-3xl leading-tight font-bold text-black">
              Is it working? 🚀
            </h1>
            <p className="mt-2 text-slate-500">
              If you see a rounded white card with a soft shadow, a purple "Tailwind CSS Test" label, and a blue button below,
              <strong> then Tailwind is installed correctly.</strong>
            </p>

            <button className="mt-6 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
              Confirm Connection
            </button>
          </div>
        </div>
      </div>

      {/* Grid Test */}
      <div className="mt-10 grid grid-cols-3 gap-4">
        <div className="h-12 w-12 bg-red-400 rounded-full animate-bounce"></div>
        <div className="h-12 w-12 bg-green-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="h-12 w-12 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      </div>
    </div>
  )
}

export default App
