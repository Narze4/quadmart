import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { v2 as cloudinary } from 'cloudinary'
import { readFileSync, existsSync } from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
})

const db = getFirestore(app)

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadImage = (path) => new Promise((resolve, reject) => {
  cloudinary.uploader.upload_stream(
    { folder: 'quadmart/listings', resource_type: 'image' },
    (err, result) => err ? reject(err) : resolve(result.secure_url)
  ).end(readFileSync(path))
})

// Download images from picsum if not already cached
import { execSync } from 'child_process'
const IMG_DIR = '/tmp/quadmart-seed-imgs'
execSync(`mkdir -p ${IMG_DIR}`)

const fetchImg = (seed, dest) => {
  if (!existsSync(`${IMG_DIR}/${dest}`)) {
    execSync(`curl -sL "https://picsum.photos/seed/${seed}/600/400" -o ${IMG_DIR}/${dest}`)
  }
  return `${IMG_DIR}/${dest}`
}

console.log('Downloading seed images...')
const imgs = {
  macbook:    fetchImg('laptop',      'macbook.jpg'),
  calculator: fetchImg('calculator',  'calculator.jpg'),
  minifridge: fetchImg('fridge',      'minifridge.jpg'),
  lamp:       fetchImg('lamp',        'lamp.jpg'),
  headphones: fetchImg('headphones',  'headphones.jpg'),
  textbook:   fetchImg('textbook',    'textbook.jpg'),
  yoga:       fetchImg('yoga',        'yoga.jpg'),
  apartment1: fetchImg('apartment1',  'apartment1.jpg'),
  apartment2: fetchImg('apartment2',  'apartment2.jpg'),
  studio:     fetchImg('studio',      'studio.jpg'),
}

console.log('Uploading to Cloudinary...')
const urls = {}
for (const [key, path] of Object.entries(imgs)) {
  urls[key] = await uploadImage(path)
  console.log(`  ✓ ${key}`)
}

const listings = [
  // Products
  { title: 'Calculus: Early Transcendentals (8th Ed)', description: 'Stewart calculus. Used one semester, no highlighting. Great condition.', price: 45, category: 'Product', condition: 'Like New', sellerEmail: 'mia.johnson@emory.edu', images: [urls.textbook] },
  { title: 'TI-84 Plus Graphing Calculator', description: 'Works perfectly. Comes with batteries and USB cable.', price: 60, category: 'Product', condition: 'Good', sellerEmail: 'luca.smith@emory.edu', images: [urls.calculator] },
  { title: 'IKEA Loft Bed Frame (Twin)', description: 'Dismantled and ready for pickup near campus. Minor scuffs on legs.', price: 80, category: 'Product', condition: 'Good', sellerEmail: 'priya.patel@emory.edu', images: [] },
  { title: 'Mini Fridge — 3.2 cu ft', description: 'Perfect for dorm. Works great, clean inside. Must pick up.', price: 55, category: 'Product', condition: 'Good', sellerEmail: 'james.wu@emory.edu', images: [urls.minifridge] },
  { title: 'MacBook Pro 14" M3 (2024)', description: '8GB RAM, 512GB SSD. AppleCare until 2027. No scratches, barely used.', price: 1350, category: 'Product', condition: 'Like New', sellerEmail: 'sara.lee@emory.edu', images: [urls.macbook] },
  { title: 'Organic Chemistry (Clayden) + Solutions Manual', description: 'Both books together. Some pencil notes in margins but fully readable.', price: 35, category: 'Product', condition: 'Fair', sellerEmail: 'noah.kim@emory.edu', images: [] },
  { title: 'Desk Lamp (adjustable, LED)', description: 'USB-C charging port on base. Barely used, moving out.', price: 18, category: 'Product', condition: 'Like New', sellerEmail: 'ava.brown@emory.edu', images: [urls.lamp] },
  { title: 'Sony WH-1000XM5 Headphones', description: 'Noise-cancelling. All original accessories. Works flawlessly.', price: 220, category: 'Product', condition: 'Like New', sellerEmail: 'ethan.davis@emory.edu', images: [urls.headphones] },
  { title: 'Yoga Mat + Foam Roller Bundle', description: "Both in great shape. Moving and can't take them. Pickup near rec center.", price: 20, category: 'Product', condition: 'Good', sellerEmail: 'olivia.martin@emory.edu', images: [urls.yoga] },
  { title: 'Principles of Economics (Mankiw, 9th Ed)', description: 'Required for ECON 101. Light wear on cover, clean pages.', price: 25, category: 'Product', condition: 'Good', sellerEmail: 'liam.garcia@emory.edu', images: [] },

  // Services
  { title: 'Python / Data Science Tutoring', description: 'CS grad student offering tutoring in Python, pandas, NumPy, and ML basics. $25/hr, flexible scheduling.', price: 25, category: 'Service', condition: 'New', sellerEmail: 'luca.smith@emory.edu', images: [] },
  { title: 'Resume & Cover Letter Review', description: 'Career center intern. Will review and give detailed feedback within 48 hours. One revision included.', price: 15, category: 'Service', condition: 'New', sellerEmail: 'mia.johnson@emory.edu', images: [] },
  { title: 'Photography — Portraits & Events', description: 'SCAD photography student. Headshots, graduations, parties. Edited gallery delivered in 5 days.', price: 75, category: 'Service', condition: 'New', sellerEmail: 'ava.brown@emory.edu', images: [] },
  { title: 'Moving Help (local, 2 hrs)', description: 'I have a truck and can help you move boxes/furniture around campus or within 10 miles. Weekends preferred.', price: 40, category: 'Service', condition: 'New', sellerEmail: 'james.wu@emory.edu', images: [] },
  { title: 'Calculus & Linear Algebra Tutoring', description: 'Math major, 4.0 GPA. MATH 1550, 1560, 2550. $20/hr, meet in library or Zoom.', price: 20, category: 'Service', condition: 'New', sellerEmail: 'noah.kim@emory.edu', images: [] },

  // Subleases
  { title: '1BR Sublease — Midtown Atlanta (June–Aug)', description: 'Fully furnished 1-bed in Midtown. 5 min walk to MARTA. $950/mo, utilities included. Available June 1.', price: 950, category: 'Sublease', condition: 'New', sellerEmail: 'priya.patel@emory.edu', images: [urls.apartment1] },
  { title: 'Room in 4BR House — Near Campus (Summer)', description: 'Private room, shared common areas. Washer/dryer, parking. $550/mo. Great roommates.', price: 550, category: 'Sublease', condition: 'New', sellerEmail: 'liam.garcia@emory.edu', images: [urls.apartment2] },
  { title: 'Studio Sublease — Tech Square Area (3 months)', description: 'Modern studio, gym & pool in building. $1100/mo. Perfect for summer internship in Atlanta.', price: 1100, category: 'Sublease', condition: 'New', sellerEmail: 'sara.lee@emory.edu', images: [urls.studio] },
  { title: 'Shared 2BR Apt — Near Campus (July–Dec)', description: 'Looking for one roommate. 2BR/2BA, 10 min from campus. $620/mo each. Pets OK.', price: 620, category: 'Sublease', condition: 'New', sellerEmail: 'ethan.davis@emory.edu', images: [] },
  { title: 'Furnished Room — Summer Sublease', description: 'Quiet house, 3 other students. $500/mo includes WiFi and utilities. Available May 15.', price: 500, category: 'Sublease', condition: 'New', sellerEmail: 'olivia.martin@emory.edu', images: [] },
]

let added = 0
for (const listing of listings) {
  await addDoc(collection(db, 'listings'), { ...listing, createdAt: serverTimestamp() })
  console.log(`✓ ${listing.title}${listing.images.length ? ' 📷' : ''}`)
  added++
}

console.log(`\nSeeded ${added} listings (${listings.filter(l => l.images.length).length} with images).`)
process.exit(0)
