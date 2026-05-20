import { useEffect, useState } from 'react'
import { Alert, Snackbar } from '@mui/material'
import { subscribeApiErrors } from '../services/apiErrors'

export default function ApiErrorToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    return subscribeApiErrors((nextMessage) => {
      setMessage(nextMessage)
    })
  }, [])

  return (
    <Snackbar
      open={Boolean(message)}
      autoHideDuration={6000}
      onClose={() => setMessage(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="error" onClose={() => setMessage(null)} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  )
}
