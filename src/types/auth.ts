export interface LoginCredentials {
  user: string
  password: string
  token_type: 'jwt'
  location_identifier: string
  company_domain: null
}

export interface TwoFactorAuth {
  user: string
  password: string
  token_type: 'jwt'
  location_identifier: string
  otp_code: string
}

export interface AuthResponse {
  access_token: string
  two_factor_auth_enabled?: boolean
  two_factor_location_identifier?: string
} 