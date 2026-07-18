import Link from "next/link";

const UNIVERSITIES = [
  { name: "Emory University", abbr: "EU", color: "#012169" },
  { name: "University of Georgia", abbr: "UGA", color: "#BA0C2F" },
  { name: "Georgia Tech", abbr: "GT", color: "#B3A369" },
  { name: "SCAD", abbr: "SCAD", color: "#000000" },
  { name: "Georgia State University", abbr: "GSU", color: "#0039A6" },
  { name: "Kennesaw State University", abbr: "KSU", color: "#FDBB30" },
  { name: "Spelman College", abbr: "SC", color: "#00356B" },
  { name: "Morehouse College", abbr: "MC", color: "#8B0000" },
  { name: "Georgia Southern University", abbr: "GSou", color: "#011E41" },
  { name: "Mercer University", abbr: "MU", color: "#F26522" },
  { name: "Agnes Scott College", abbr: "ASC", color: "#002868" },
  { name: "University of West Georgia", abbr: "UWG", color: "#8B0000" },
  { name: "Augusta University", abbr: "AU", color: "#003087" },
  { name: "Valdosta State University", abbr: "VSU", color: "#1F3C88" },
  { name: "Clayton State University", abbr: "CSU", color: "#003366" },
  { name: "Columbus State University", abbr: "ColSU", color: "#002855" },
];

const STEPS = [
  {
    icon: "🎓",
    title: "Sign up with .edu",
    desc: "Verify your student status with your school email — no strangers, just fellow students.",
  },
  {
    icon: "🛍️",
    title: "Browse your campus",
    desc: "See listings from students at your own school only. Textbooks, furniture, rides, and more.",
  },
  {
    icon: "🔒",
    title: "Buy & sell safely",
    desc: "Message directly, meet up on campus, and trade with people you already share a community with.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-full flex flex-col bg-white">
      {/* Navbar */}
      <nav className="bg-[#1a472a] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-white text-2xl font-bold tracking-tight">
            QuadMart
          </span>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-white border border-white rounded-xl hover:bg-white hover:text-[#1a472a] transition-all duration-200"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-medium bg-white text-[#1a472a] rounded-xl hover:bg-gray-100 transition-all duration-200 active:scale-95"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative overflow-hidden text-white px-6 py-28"
        style={{ background: "linear-gradient(135deg, #2d8a5e 0%, #1a5c3a 55%, #123d27 100%)" }}
      >
        {/* Grain / dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Floating accents */}
        <span className="hidden sm:block absolute top-16 left-[8%] text-5xl opacity-20 -rotate-12" aria-hidden="true">📚</span>
        <span className="hidden sm:block absolute bottom-14 left-[16%] text-4xl opacity-20 rotate-6" aria-hidden="true">🛋️</span>
        <span className="hidden sm:block absolute top-20 right-[10%] text-5xl opacity-20 rotate-12" aria-hidden="true">🚲</span>

        <div className="relative max-w-6xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6 tracking-tight">
            Buy &amp; sell on your campus.
            <br />
            <span className="text-green-300">Fast. Safe. Student-only.</span>
          </h1>
          <p className="text-lg text-green-100 max-w-xl mx-auto mb-10">
            Verify your student status with your .edu email and connect with
            buyers and sellers right on campus.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 bg-white text-[#1a472a] font-semibold rounded-xl hover:bg-gray-100 transition-all duration-200 active:scale-95 text-base"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* University Cards */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            Available at your school
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {UNIVERSITIES.map((uni) => (
              <div
                key={uni.name}
                className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: uni.color }}
                  aria-hidden="true"
                />
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: uni.color }}
                >
                  {uni.abbr}
                </div>
                <span className="text-sm font-medium text-gray-800 text-center">
                  {uni.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            How it works
          </h2>
          <p className="text-sm text-gray-500 text-center mb-10">
            Three steps and you&apos;re trading with your campus.
          </p>
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center text-2xl mb-4">
                  {step.icon}
                </div>
                <p className="text-xs font-semibold text-green-600 mb-1">STEP {i + 1}</p>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-[#1a472a] text-green-200 text-center py-10 px-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <span className="text-white font-bold text-lg">QuadMart</span>
        </div>
        <p className="text-sm text-green-300 mb-4">Your campus marketplace, student to student.</p>
        <p className="text-xs">
          © {new Date().getFullYear()} QuadMart · Student Marketplace
        </p>
      </footer>
    </div>
  );
}
