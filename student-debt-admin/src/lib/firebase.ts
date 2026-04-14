import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyA6H7KdE4rjbTKDWisjs1unqqiYkvwHbTA',
  authDomain: 'hu-student-debt.firebaseapp.com',
  projectId: 'hu-student-debt',
  storageBucket: 'hu-student-debt.firebasestorage.app',
  messagingSenderId: '119600048653',
  appId: '1:119600048653:web:45315a6792fb0d19e38344',
  measurementId: 'G-L6EVX0G022',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
