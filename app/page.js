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
              className="px-4 py-2 text-sm font-medium text-white border border-white rounded-lg hover:bg-white hover:text-[#1a472a] transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-medium bg-white text-[#1a472a] rounded-lg hover:bg-gray-100 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#1a472a] text-white px-6 py-24">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
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
            className="inline-block px-8 py-3 bg-white text-[#1a472a] font-semibold rounded-full hover:bg-gray-100 transition-colors text-base"
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
                className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center gap-3 shadow-sm hover:shadow-md transition-shadow"
              >
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

      {/* What is QuadMart? */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            What is QuadMart?
          </h2>
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl mb-3">🎓</div>
              <h3 className="font-semibold text-gray-900 mb-2">Student-Only</h3>
              <p className="text-sm text-gray-600">
                Every account is verified with a .edu email, so you only trade
                with fellow students.
              </p>
            </div>
            <div>
              <div className="text-3xl mb-3">🛍️</div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Buy, Sell &amp; Sublease
              </h3>
              <p className="text-sm text-gray-600">
                Post products, offer services, or find a sublease — all in one
                place.
              </p>
            </div>
            <div>
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Safe &amp; Local
              </h3>
              <p className="text-sm text-gray-600">
                Meet up on campus with people you already share a community
                with.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-[#1a472a] text-green-200 text-center text-sm py-6">
        © {new Date().getFullYear()} QuadMart · Student Marketplace
      </footer>
    </div>
  );
}
