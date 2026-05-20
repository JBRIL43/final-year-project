import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // Premium Tech Blue
      light: '#eff6ff',
      dark: '#1e40af',
    },
    secondary: {
      main: '#475569', // Slate
      light: '#f8fafc',
      dark: '#334155',
    },
    background: {
      default: '#f8fafc', // Premium cool grey-blue
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a', // Deep slate
      secondary: '#64748b', // Muted slate
    },
    success: {
      main: '#10b981', // Emerald
      light: '#ecfdf5',
    },
    warning: {
      main: '#f59e0b', // Amber
      light: '#fffbeb',
    },
    error: {
      main: '#ef4444', // Rose
      light: '#fef2f2',
    },
    info: {
      main: '#06b6d4', // Cyan
      light: '#ecfeff',
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", "Segoe UI", "Roboto", sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontWeight: 800, letterSpacing: '-0.01em' },
    h4: { fontWeight: 800, letterSpacing: '-0.01em' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body1: { fontSize: '0.975rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.6 },
    button: {
      textTransform: 'none',
      fontWeight: 700,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          padding: '8px 18px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
        },
        elevation1: {
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#f8fafc',
          color: '#475569',
          borderBottom: '2px solid #e2e8f0',
          padding: '16px 20px',
        },
        root: {
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: '#f8fafc',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#ffffff',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#cbd5e1',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#2563eb',
              borderWidth: 2,
            },
          },
        },
      },
    },
  },
})
export default theme
