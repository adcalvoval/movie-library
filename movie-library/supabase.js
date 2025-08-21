// Supabase configuration for Movie Library
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://inngpukwayrazupyrefr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubmdwdWt3YXlyYXp1cHlyZWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MDQ5NzQsImV4cCI6MjA3MTM4MDk3NH0.3RQwAT-TfbjmCY4rt6fpKurv4V2OWnB9HRGGgKQIHck'

// Import Supabase client (add this script tag to your HTML)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

class SupabaseClient {
    constructor() {
        this.supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        this.user = null
        this.isOnline = navigator.onLine
        this.pendingSync = []
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true
            this.syncPendingChanges()
        })
        
        window.addEventListener('offline', () => {
            this.isOnline = false
        })
    }

    // Authentication methods
    async signUp(email, password) {
        if (!this.supabase) throw new Error('Supabase not initialized')
        
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password
        })
        
        if (error) throw error
        return data
    }

    async signIn(email, password) {
        if (!this.supabase) throw new Error('Supabase not initialized')
        
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        })
        
        if (error) throw error
        this.user = data.user
        return data
    }

    async signOut() {
        if (!this.supabase) throw new Error('Supabase not initialized')
        
        const { error } = await this.supabase.auth.signOut()
        if (error) throw error
        this.user = null
    }

    async getCurrentUser() {
        if (!this.supabase) return null
        
        const { data: { user } } = await this.supabase.auth.getUser()
        this.user = user
        return user
    }

    // Movie wishlist methods
    async getMovieWishlist() {
        if (!this.supabase || !this.user) return []
        
        const { data, error } = await this.supabase
            .from('movie_wishlist')
            .select('*')
            .eq('user_id', this.user.id)
            .order('created_at', { ascending: false })
        
        if (error) throw error
        return data || []
    }

    async addMovieToWishlist(movie) {
        if (!this.supabase || !this.user) {
            this.addToPendingSync('movie_wishlist', 'insert', movie)
            return
        }

        const { data, error } = await this.supabase
            .from('movie_wishlist')
            .insert({
                user_id: this.user.id,
                tmdb_id: movie.id,
                title: movie.title,
                year: movie.year,
                poster_url: movie.poster,
                director: movie.director,
                actors: movie.actors,
                genres: movie.genres,
                overview: movie.overview
            })
            .select()

        if (error) throw error
        return data[0]
    }

    async removeMovieFromWishlist(tmdbId) {
        if (!this.supabase || !this.user) {
            this.addToPendingSync('movie_wishlist', 'delete', { tmdb_id: tmdbId })
            return
        }

        const { error } = await this.supabase
            .from('movie_wishlist')
            .delete()
            .eq('user_id', this.user.id)
            .eq('tmdb_id', tmdbId)

        if (error) throw error
    }

    // TV wishlist methods
    async getTvWishlist() {
        if (!this.supabase || !this.user) return []
        
        const { data, error } = await this.supabase
            .from('tv_wishlist')
            .select('*')
            .eq('user_id', this.user.id)
            .order('created_at', { ascending: false })
        
        if (error) throw error
        return data || []
    }

    async addTvToWishlist(show) {
        if (!this.supabase || !this.user) {
            this.addToPendingSync('tv_wishlist', 'insert', show)
            return
        }

        const { data, error } = await this.supabase
            .from('tv_wishlist')
            .insert({
                user_id: this.user.id,
                tmdb_id: show.id,
                title: show.title,
                first_air_year: show.first_air_year,
                poster_url: show.poster,
                creator: show.creator,
                seasons: show.seasons,
                genres: show.genres,
                overview: show.overview
            })
            .select()

        if (error) throw error
        return data[0]
    }

    async removeTvFromWishlist(tmdbId) {
        if (!this.supabase || !this.user) {
            this.addToPendingSync('tv_wishlist', 'delete', { tmdb_id: tmdbId })
            return
        }

        const { error } = await this.supabase
            .from('tv_wishlist')
            .delete()
            .eq('user_id', this.user.id)
            .eq('tmdb_id', tmdbId)

        if (error) throw error
    }

    // Offline sync methods
    addToPendingSync(table, operation, data) {
        this.pendingSync.push({ table, operation, data, timestamp: Date.now() })
        localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync))
    }

    async syncPendingChanges() {
        if (!this.isOnline || !this.user || this.pendingSync.length === 0) return

        const pendingChanges = [...this.pendingSync]
        this.pendingSync = []

        for (const change of pendingChanges) {
            try {
                if (change.operation === 'insert') {
                    if (change.table === 'movie_wishlist') {
                        await this.addMovieToWishlist(change.data)
                    } else if (change.table === 'tv_wishlist') {
                        await this.addTvToWishlist(change.data)
                    }
                } else if (change.operation === 'delete') {
                    if (change.table === 'movie_wishlist') {
                        await this.removeMovieFromWishlist(change.data.tmdb_id)
                    } else if (change.table === 'tv_wishlist') {
                        await this.removeTvFromWishlist(change.data.tmdb_id)
                    }
                }
            } catch (error) {
                console.error('Sync error:', error)
                // Re-add failed sync to queue
                this.pendingSync.push(change)
            }
        }

        localStorage.setItem('pendingSync', JSON.stringify(this.pendingSync))
    }

    // Migration method for existing localStorage data
    async migrateLocalStorageData() {
        if (!this.user) return

        // Migrate movie wishlist
        const movieWishlist = localStorage.getItem('movieWishlist')
        if (movieWishlist) {
            const movies = JSON.parse(movieWishlist)
            for (const movie of movies) {
                try {
                    await this.addMovieToWishlist(movie)
                } catch (error) {
                    console.error('Error migrating movie:', error)
                }
            }
            localStorage.removeItem('movieWishlist')
        }

        // Migrate TV wishlist
        const tvWishlist = localStorage.getItem('tvWishlist')
        if (tvWishlist) {
            const shows = JSON.parse(tvWishlist)
            for (const show of shows) {
                try {
                    await this.addTvToWishlist(show)
                } catch (error) {
                    console.error('Error migrating TV show:', error)
                }
            }
            localStorage.removeItem('tvWishlist')
        }
    }
}

// Export for use in other files
window.SupabaseClient = SupabaseClient