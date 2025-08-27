class MovieLibrary {
    constructor() {
        this.apiKey = '55f0ddaef40cc8b23ea0c0f194f13b56';
        this.bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1NWYwZGRhZWY0MGNjOGIyM2VhMGMwZjE5NGYxM2I1NiIsIm5iZiI6MTc1NTc2NjIzOS41Niwic3ViIjoiNjhhNmRkZGY2N2FmOWRkNjE1ZmQyYjc2Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.A6_7zOdwRMEPvuCXuAz8Wzem3Md9lIDU85j7dtDh1fU';
        this.baseUrl = 'https://api.themoviedb.org/3';
        this.imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
        
        // Initialize Supabase client if available
        this.supabaseClient = null;
        this.currentUser = null;
        this.isOnline = navigator.onLine;
        
        // Initialize wishlists
        this.movieWishlist = [];
        this.tvWishlist = [];
        this.searchResults = [];
        this.currentSort = 'title';
        this.activeTab = 'movies';
        this.activeGenreFilter = null;
        
        this.init();
    }

    async init() {
        // Initialize Supabase client
        await this.initializeSupabase();
        
        // Load data (from Supabase if authenticated, otherwise localStorage)
        await this.loadData();
        
        // Setup UI
        this.renderMovieWishlist();
        this.renderTvWishlist();
        this.setupEventListeners();
        this.setupTabs();
        this.updateAuthUI();
        
        // Setup online/offline listeners
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateAuthUI();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateAuthUI();
        });
    }

    async initializeSupabase() {
        try {
            if (typeof SupabaseClient !== 'undefined') {
                this.supabaseClient = new SupabaseClient();
                this.currentUser = await this.supabaseClient.getCurrentUser();
            }
        } catch (error) {
            console.error('Supabase initialization error:', error);
        }
    }

    async loadData() {
        if (this.currentUser && this.supabaseClient) {
            // Load from Supabase
            try {
                const movieData = await this.supabaseClient.getMovieWishlist();
                const tvData = await this.supabaseClient.getTvWishlist();
                
                // Map database field names to expected field names
                this.movieWishlist = movieData.map(movie => ({
                    ...movie,
                    poster: movie.poster_url,
                    id: movie.tmdb_id
                }));
                
                this.tvWishlist = tvData.map(show => ({
                    ...show,
                    poster: show.poster_url,
                    id: show.tmdb_id
                }));
            } catch (error) {
                console.error('Error loading from Supabase:', error);
                // Fallback to localStorage
                this.loadFromLocalStorage();
            }
        } else {
            // Load from localStorage
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        this.movieWishlist = this.loadMovieWishlist();
        this.tvWishlist = this.loadTvWishlist();
    }

    updateAuthUI() {
        const authSection = document.getElementById('authSection');
        if (!authSection) return;

        if (this.currentUser) {
            authSection.innerHTML = `
                <span class="sync-status ${this.isOnline ? 'online' : 'offline'}">
                    ${this.isOnline ? '🟢 Synced' : '🔴 Offline'}
                </span>
                <span>Welcome, ${this.currentUser.email}</span>
                <button class="auth-btn secondary" onclick="movieLibrary.signOut()">Sign Out</button>
            `;
        } else {
            authSection.innerHTML = `
                <span class="sync-status offline">🔴 Local Only</span>
                <button class="auth-btn" onclick="movieLibrary.showAuth()">Sign In</button>
            `;
        }
    }

    async showAuth() {
        // Simple prompt-based auth for now
        const action = prompt('Enter "signin" to sign in or "signup" to create account:');
        if (!action) return;

        const email = prompt('Enter your email:');
        if (!email) return;

        const password = prompt('Enter your password:');
        if (!password) return;

        try {
            if (action === 'signup') {
                await this.supabaseClient.signUp(email, password);
                alert('Check your email for verification link!');
            } else {
                await this.supabaseClient.signIn(email, password);
                this.currentUser = await this.supabaseClient.getCurrentUser();
                
                // Migrate existing data
                await this.migrateLocalData();
                
                // Reload data from Supabase
                await this.loadData();
                this.renderMovieWishlist();
                this.renderTvWishlist();
                this.updateAuthUI();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }

    async signOut() {
        if (this.supabaseClient) {
            await this.supabaseClient.signOut();
            this.currentUser = null;
            this.updateAuthUI();
            
            // Reload from localStorage
            this.loadFromLocalStorage();
            this.renderMovieWishlist();
            this.renderTvWishlist();
        }
    }

    async migrateLocalData() {
        if (!this.supabaseClient || !this.currentUser) return;
        
        try {
            await this.supabaseClient.migrateLocalStorageData();
            alert('Your existing wishlist data has been migrated to the cloud!');
        } catch (error) {
            console.error('Migration error:', error);
        }
    }

    setupEventListeners() {
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('movieSearch');
        const movieSortSelect = document.getElementById('movieSortSelect');
        const tvSortSelect = document.getElementById('tvSortSelect');

        searchBtn.addEventListener('click', () => this.searchContent());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchContent();
            }
        });
        
        movieSortSelect.addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderMovieWishlist();
        });
        
        tvSortSelect.addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderTvWishlist();
        });
    }

    setupTabs() {
        // Content tabs
        const contentTabs = document.querySelectorAll('.content-tab');
        contentTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabType = e.target.dataset.tab;
                this.switchContentTab(tabType);
            });
        });

        // Search type tabs
        const searchTabs = document.querySelectorAll('.search-tab');
        searchTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const searchType = e.target.dataset.type;
                this.switchSearchType(searchType);
            });
        });
    }

    switchContentTab(tabType) {
        // Update active tab
        document.querySelectorAll('.content-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabType);
        });

        // Show/hide sections
        document.getElementById('movies-section').classList.toggle('hidden', tabType !== 'movies');
        document.getElementById('tv-section').classList.toggle('hidden', tabType !== 'tv');
        
        this.activeTab = tabType;
    }

    switchSearchType(searchType) {
        // Update active search tab
        document.querySelectorAll('.search-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === searchType);
        });
        
        // Update placeholder
        const searchInput = document.getElementById('movieSearch');
        if (searchType === 'movies') {
            searchInput.placeholder = 'Search for movies...';
        } else {
            searchInput.placeholder = 'Search for TV shows...';
        }
    }

    async searchContent() {
        const searchInput = document.getElementById('movieSearch');
        const query = searchInput.value.trim();
        
        if (!query) {
            this.showError('Please enter a search term');
            return;
        }

        // Determine search type from active tab
        const activeSearchTab = document.querySelector('.search-tab.active');
        const searchType = activeSearchTab.dataset.type; // 'movies' or 'tv'
        
        if (searchType === 'movies') {
            await this.searchMovies(query);
        } else {
            await this.searchTvShows(query);
        }
    }

    async searchMovies(query) {
        this.showLoading();
        
        try {
            // First, search for movies by the full query
            const searchResponse = await fetch(
                `${this.baseUrl}/search/movie?query=${encodeURIComponent(query)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.bearerToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const searchData = await searchResponse.json();

            // If no direct movie results, try searching by person (actor/director)
            if (!searchData.results || searchData.results.length === 0) {
                const personResults = await this.searchMoviesByPerson(query);
                if (personResults.length > 0) {
                    const rankedResults = this.rankSearchResults(personResults, query);
                    this.searchResults = rankedResults;
                    this.displaySearchResults(rankedResults);
                    return;
                }
            }

            if (searchData.results && searchData.results.length > 0) {
                // Get detailed info for multiple results to enable smart matching
                const detailedResults = await Promise.all(
                    searchData.results.slice(0, 10).map(async (movie) => {
                        try {
                            const detailsResponse = await fetch(
                                `${this.baseUrl}/movie/${movie.id}?append_to_response=credits`,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${this.bearerToken}`,
                                        'Content-Type': 'application/json'
                                    }
                                }
                            );
                            const movieDetails = await detailsResponse.json();

                            return {
                                id: movieDetails.id,
                                title: movieDetails.title,
                                year: new Date(movieDetails.release_date).getFullYear() || 'Unknown',
                                poster: movieDetails.poster_path ? `${this.imageBaseUrl}${movieDetails.poster_path}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBvc3RlcjwvdGV4dD48L3N2Zz4=',
                                director: this.getDirector(movieDetails.credits.crew),
                                actors: this.getMainActors(movieDetails.credits.cast),
                                genres: this.getGenres(movieDetails.genres),
                                overview: movieDetails.overview,
                                credits: movieDetails.credits
                            };
                        } catch (error) {
                            console.error(`Error fetching details for movie ${movie.id}:`, error);
                            return null;
                        }
                    })
                );

                const validResults = detailedResults.filter(result => result !== null);
                
                if (validResults.length > 0) {
                    // Apply smart matching to find the best results
                    const rankedResults = this.rankSearchResults(validResults, query);
                    this.searchResults = rankedResults; // Store for later use
                    this.displaySearchResults(rankedResults);
                } else {
                    this.showError('No movies found. Please try a different search.');
                }
            } else {
                this.showError('No movies found. Please try a different search.');
            }
        } catch (error) {
            console.error('Error searching for movies:', error);
            this.showError('Error searching for movies. Please try again.');
        }
    }

    async searchTvShows(query) {
        this.showLoading();
        
        try {
            // Search for TV shows
            const searchResponse = await fetch(
                `${this.baseUrl}/search/tv?query=${encodeURIComponent(query)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.bearerToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const searchData = await searchResponse.json();

            // If no direct TV results, try searching by person (actor/creator)
            if (!searchData.results || searchData.results.length === 0) {
                const personResults = await this.searchTvShowsByPerson(query);
                if (personResults.length > 0) {
                    const rankedResults = this.rankTvSearchResults(personResults, query);
                    this.searchResults = rankedResults;
                    this.displayTvSearchResults(rankedResults);
                    return;
                }
            }

            if (searchData.results && searchData.results.length > 0) {
                // Get detailed info for multiple results
                const detailedResults = await Promise.all(
                    searchData.results.slice(0, 10).map(async (show) => {
                        try {
                            const detailsResponse = await fetch(
                                `${this.baseUrl}/tv/${show.id}?append_to_response=credits`,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${this.bearerToken}`,
                                        'Content-Type': 'application/json'
                                    }
                                }
                            );
                            const showDetails = await detailsResponse.json();

                            return {
                                id: showDetails.id,
                                title: showDetails.name,
                                first_air_year: new Date(showDetails.first_air_date).getFullYear() || 'Unknown',
                                poster: showDetails.poster_path ? `${this.imageBaseUrl}${showDetails.poster_path}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBvc3RlcjwvdGV4dD48L3N2Zz4=',
                                creator: this.getCreator(showDetails.created_by),
                                genres: this.getGenres(showDetails.genres),
                                seasons: showDetails.number_of_seasons || 'Unknown',
                                overview: showDetails.overview,
                                credits: showDetails.credits,
                                type: 'tv'
                            };
                        } catch (error) {
                            console.error(`Error fetching details for TV show ${show.id}:`, error);
                            return null;
                        }
                    })
                );

                const validResults = detailedResults.filter(result => result !== null);
                
                if (validResults.length > 0) {
                    // Apply smart matching to find the best results
                    const rankedResults = this.rankTvSearchResults(validResults, query);
                    this.searchResults = rankedResults; // Store for later use
                    this.displayTvSearchResults(rankedResults);
                } else {
                    this.showError('No TV shows found. Please try a different search.');
                }
            } else {
                this.showError('No TV shows found. Please try a different search.');
            }
        } catch (error) {
            console.error('Error searching for TV shows:', error);
            this.showError('Error searching for TV shows. Please try again.');
        }
    }

    rankSearchResults(results, query) {
        const searchTerms = query.toLowerCase().split(/\s+/);
        
        return results.map(movie => {
            let score = 0;
            let matchReasons = [];
            
            // Title matching (highest weight)
            const titleWords = movie.title.toLowerCase().split(/\s+/);
            const titleMatches = searchTerms.filter(term => 
                titleWords.some(word => word.includes(term))
            ).length;
            score += titleMatches * 10;
            if (titleMatches > 0) {
                matchReasons.push('title');
            }
            
            // Director matching
            const directorMatch = searchTerms.some(term => 
                movie.director.toLowerCase().includes(term)
            );
            if (directorMatch) {
                score += 5;
                matchReasons.push('director');
            }
            
            // Actor matching
            const actorMatch = searchTerms.some(term => {
                return movie.credits.cast.some(actor => 
                    actor.name.toLowerCase().includes(term)
                );
            });
            if (actorMatch) {
                score += 3;
                matchReasons.push('actor');
            }
            
            // Year matching
            const yearMatch = searchTerms.some(term => 
                term === movie.year.toString()
            );
            if (yearMatch) {
                score += 2;
                matchReasons.push('year');
            }
            
            return {
                ...movie,
                score,
                matchReasons: matchReasons.length > 0 ? matchReasons : ['title similarity']
            };
        }).sort((a, b) => b.score - a.score);
    }

    displaySearchResults(results) {
        const searchResults = document.getElementById('searchResults');
        
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="error">No matching movies found.</div>';
            return;
        }

        searchResults.innerHTML = results.map(movie => `
            <div class="search-result-item">
                <img src="${movie.poster}" alt="${movie.title}" class="search-result-poster" />
                <div class="search-result-info">
                    <div class="search-result-title">${movie.title} (${movie.year})</div>
                    <div class="search-result-details">Director: ${movie.director}</div>
                    <div class="search-result-details">Starring: ${movie.actors}</div>
                    <div class="search-result-match">Match: ${movie.matchReasons.join(', ')}</div>
                </div>
                <button class="wishlist-btn" onclick="movieLibrary.addToWishlistById(${movie.id})">
                    <span class="wishlist-btn-icon">+</span>
                    <span class="wishlist-btn-text">Add to Wishlist</span>
                </button>
            </div>
        `).join('');
    }

    async addToWishlistById(movieId) {
        const movieData = this.searchResults.find(m => m.id === movieId);
        if (!movieData) {
            this.showError('Movie not found in search results.');
            return;
        }
        
        // Check if movie already exists in wishlist
        if (this.movieWishlist.find(m => m.id === movieData.id)) {
            this.showError('Movie already in your wishlist!');
            return;
        }
        
        this.movieWishlist.push(movieData);
        
        // Save to Supabase if authenticated, otherwise localStorage
        if (this.currentUser && this.supabaseClient) {
            try {
                await this.supabaseClient.addMovieToWishlist(movieData);
            } catch (error) {
                console.error('Error saving to Supabase:', error);
                // Fallback to localStorage
                this.saveMovieWishlist();
            }
        } else {
            this.saveMovieWishlist();
        }
        
        this.renderMovieWishlist();
        this.clearSearchResults();
        document.getElementById('movieSearch').value = '';
    }

    async addToTvWishlistById(tvId) {
        const tvData = this.searchResults.find(t => t.id === tvId);
        if (!tvData) {
            this.showError('TV show not found in search results.');
            return;
        }
        
        // Check if TV show already exists in wishlist
        if (this.tvWishlist.find(t => t.id === tvData.id)) {
            this.showError('TV show already in your wishlist!');
            return;
        }
        
        this.tvWishlist.push(tvData);
        
        // Save to Supabase if authenticated, otherwise localStorage
        if (this.currentUser && this.supabaseClient) {
            try {
                await this.supabaseClient.addTvToWishlist(tvData);
            } catch (error) {
                console.error('Error saving to Supabase:', error);
                // Fallback to localStorage
                this.saveTvWishlist();
            }
        } else {
            this.saveTvWishlist();
        }
        
        this.renderTvWishlist();
        this.clearSearchResults();
        document.getElementById('movieSearch').value = '';
    }

    addToWishlist(movieId, encodedMovieData) {
        try {
            const movieData = JSON.parse(decodeURIComponent(encodedMovieData));
            
            // Check if movie already exists in wishlist
            if (this.movieWishlist.find(m => m.id === movieData.id)) {
                this.showError('Movie already in your wishlist!');
                return;
            }
            
            this.movieWishlist.push(movieData);
            this.saveMovieWishlist();
            this.renderMovieWishlist();
            this.clearSearchResults();
            document.getElementById('movieSearch').value = '';
        } catch (error) {
            console.error('Error adding movie to wishlist:', error);
            this.showError('Error adding movie to wishlist. Please try again.');
        }
    }


    clearSearchResults() {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '';
    }

    getDirector(crew) {
        const director = crew.find(person => person.job === 'Director');
        return director ? director.name : 'Unknown Director';
    }

    getMainActors(cast) {
        return cast.slice(0, 3).map(actor => actor.name).join(', ');
    }

    getGenres(genres) {
        if (!genres || genres.length === 0) return [];
        return genres.map(genre => genre.name);
    }

    getGenresString(genres) {
        if (!genres || genres.length === 0) return 'Unknown';
        return genres.join(', ');
    }

    getCreator(createdBy) {
        if (!createdBy || createdBy.length === 0) return 'Unknown Creator';
        return createdBy[0].name;
    }

    rankTvSearchResults(results, query) {
        const searchTerms = query.toLowerCase().split(/\s+/);
        
        return results.map(show => {
            let score = 0;
            let matchReasons = [];
            
            // Title matching (highest weight)
            const titleWords = show.title.toLowerCase().split(/\s+/);
            const titleMatches = searchTerms.filter(term => 
                titleWords.some(word => word.includes(term))
            ).length;
            score += titleMatches * 10;
            if (titleMatches > 0) {
                matchReasons.push('title');
            }
            
            // Creator matching
            const creatorMatch = searchTerms.some(term => 
                show.creator.toLowerCase().includes(term)
            );
            if (creatorMatch) {
                score += 5;
                matchReasons.push('creator');
            }
            
            // Actor matching (from credits)
            const actorMatch = searchTerms.some(term => {
                return show.credits.cast.some(actor => 
                    actor.name.toLowerCase().includes(term)
                );
            });
            if (actorMatch) {
                score += 3;
                matchReasons.push('actor');
            }
            
            // Year matching
            const yearMatch = searchTerms.some(term => 
                term === show.first_air_year.toString()
            );
            if (yearMatch) {
                score += 2;
                matchReasons.push('year');
            }
            
            return {
                ...show,
                score,
                matchReasons: matchReasons.length > 0 ? matchReasons : ['title similarity']
            };
        }).sort((a, b) => b.score - a.score);
    }

    displayTvSearchResults(results) {
        const searchResults = document.getElementById('searchResults');
        
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="error">No matching TV shows found.</div>';
            return;
        }

        searchResults.innerHTML = results.map(show => `
            <div class="search-result-item">
                <img src="${show.poster}" alt="${show.title}" class="search-result-poster" />
                <div class="search-result-info">
                    <div class="search-result-title">${show.title} (${show.first_air_year})</div>
                    <div class="search-result-details">Creator: ${show.creator}</div>
                    <div class="search-result-details">Seasons: ${show.seasons}</div>
                    <div class="search-result-match">Match: ${show.matchReasons.join(', ')}</div>
                </div>
                <button class="wishlist-btn" onclick="movieLibrary.addToTvWishlistById(${show.id})">
                    <span class="wishlist-btn-icon">+</span>
                    <span class="wishlist-btn-text">Add to Wishlist</span>
                </button>
            </div>
        `).join('');
    }

    async searchMoviesByPerson(personName) {
        try {
            // Search for the person first
            const personSearchResponse = await fetch(
                `${this.baseUrl}/search/person?query=${encodeURIComponent(personName)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.bearerToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const personSearchData = await personSearchResponse.json();

            if (!personSearchData.results || personSearchData.results.length === 0) {
                return [];
            }

            // Get the most relevant person (first result)
            const person = personSearchData.results[0];

            // Get their movie credits
            const creditsResponse = await fetch(
                `${this.baseUrl}/person/${person.id}/movie_credits`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.bearerToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const creditsData = await creditsResponse.json();

            // Combine cast and crew movies, prioritizing cast
            let movies = [...(creditsData.cast || []), ...(creditsData.crew || [])];
            
            // Remove duplicates and sort by popularity
            const uniqueMovies = movies.reduce((acc, movie) => {
                if (!acc.find(m => m.id === movie.id)) {
                    acc.push(movie);
                }
                return acc;
            }, []);

            // Sort by popularity and take top 10
            uniqueMovies.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            const topMovies = uniqueMovies.slice(0, 10);

            // Get detailed info for these movies
            const detailedResults = await Promise.all(
                topMovies.map(async (movie) => {
                    try {
                        const detailsResponse = await fetch(
                            `${this.baseUrl}/movie/${movie.id}?append_to_response=credits`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${this.bearerToken}`,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        const movieDetails = await detailsResponse.json();

                        return {
                            id: movieDetails.id,
                            title: movieDetails.title,
                            year: new Date(movieDetails.release_date).getFullYear() || 'Unknown',
                            poster: movieDetails.poster_path ? `${this.imageBaseUrl}${movieDetails.poster_path}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBvc3RlcjwvdGV4dD48L3N2Zz4=',
                            director: this.getDirector(movieDetails.credits.crew),
                            actors: this.getMainActors(movieDetails.credits.cast),
                            genres: this.getGenres(movieDetails.genres),
                            overview: movieDetails.overview,
                            credits: movieDetails.credits
                        };
                    } catch (error) {
                        console.error(`Error fetching details for movie ${movie.id}:`, error);
                        return null;
                    }
                })
            );

            return detailedResults.filter(result => result !== null);
        } catch (error) {
            console.error('Error searching movies by person:', error);
            return [];
        }
    }

    async searchTvShowsByPerson(personName) {
        try {
            // Search for the person first
            const personSearchResponse = await fetch(
                `${this.baseUrl}/search/person?query=${encodeURIComponent(personName)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.bearerToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const personSearchData = await personSearchResponse.json();

            if (!personSearchData.results || personSearchData.results.length === 0) {
                return [];
            }

            // Get the most relevant person (first result)
            const person = personSearchData.results[0];

            // Get their TV credits
            const creditsResponse = await fetch(
                `${this.baseUrl}/person/${person.id}/tv_credits`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.bearerToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const creditsData = await creditsResponse.json();

            // Combine cast and crew shows, prioritizing cast
            let shows = [...(creditsData.cast || []), ...(creditsData.crew || [])];
            
            // Remove duplicates and sort by popularity
            const uniqueShows = shows.reduce((acc, show) => {
                if (!acc.find(s => s.id === show.id)) {
                    acc.push(show);
                }
                return acc;
            }, []);

            // Sort by popularity and take top 10
            uniqueShows.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            const topShows = uniqueShows.slice(0, 10);

            // Get detailed info for these shows
            const detailedResults = await Promise.all(
                topShows.map(async (show) => {
                    try {
                        const detailsResponse = await fetch(
                            `${this.baseUrl}/tv/${show.id}?append_to_response=credits`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${this.bearerToken}`,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        const showDetails = await detailsResponse.json();

                        return {
                            id: showDetails.id,
                            title: showDetails.name,
                            first_air_year: new Date(showDetails.first_air_date).getFullYear() || 'Unknown',
                            poster: showDetails.poster_path ? `${this.imageBaseUrl}${showDetails.poster_path}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBvc3RlcjwvdGV4dD48L3N2Zz4=',
                            creator: this.getCreator(showDetails.created_by),
                            genres: this.getGenres(showDetails.genres),
                            seasons: showDetails.number_of_seasons || 'Unknown',
                            overview: showDetails.overview,
                            credits: showDetails.credits,
                            type: 'tv'
                        };
                    } catch (error) {
                        console.error(`Error fetching details for TV show ${show.id}:`, error);
                        return null;
                    }
                })
            );

            return detailedResults.filter(result => result !== null);
        } catch (error) {
            console.error('Error searching TV shows by person:', error);
            return [];
        }
    }


    sortWishlist(movies, sortBy) {
        const sortedMovies = [...movies];
        
        switch(sortBy) {
            case 'title':
                return sortedMovies.sort((a, b) => a.title.localeCompare(b.title));
            case 'title-desc':
                return sortedMovies.sort((a, b) => b.title.localeCompare(a.title));
            case 'year':
                return sortedMovies.sort((a, b) => a.year - b.year);
            case 'year-desc':
                return sortedMovies.sort((a, b) => b.year - a.year);
            case 'genre':
                return sortedMovies.sort((a, b) => {
                    const aGenre = Array.isArray(a.genres) && a.genres.length > 0 ? a.genres[0] : '';
                    const bGenre = Array.isArray(b.genres) && b.genres.length > 0 ? b.genres[0] : '';
                    return aGenre.localeCompare(bGenre);
                });
            case 'genre-desc':
                return sortedMovies.sort((a, b) => {
                    const aGenre = Array.isArray(a.genres) && a.genres.length > 0 ? a.genres[0] : '';
                    const bGenre = Array.isArray(b.genres) && b.genres.length > 0 ? b.genres[0] : '';
                    return bGenre.localeCompare(aGenre);
                });
            default:
                return sortedMovies;
        }
    }

    showLoading() {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '<div class="loading">Searching for movies...</div>';
    }

    hideLoading() {
        // Loading will be hidden when renderMovies is called
    }

    showError(message) {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = `<div class="error">${message}</div>`;
        setTimeout(() => {
            this.clearSearchResults();
        }, 3000);
    }

    // Legacy support - migrate old wishlist to movie wishlist
    loadMovieWishlist() {
        let stored = localStorage.getItem('movieWishlist');
        if (!stored) {
            // Check for old wishlist data
            const oldWishlist = localStorage.getItem('movieWishlist');
            if (oldWishlist) {
                stored = oldWishlist;
                localStorage.setItem('movieWishlist', stored);
            }
        }
        return stored ? JSON.parse(stored) : [];
    }

    loadTvWishlist() {
        const stored = localStorage.getItem('tvWishlist');
        return stored ? JSON.parse(stored) : [];
    }

    saveMovieWishlist() {
        localStorage.setItem('movieWishlist', JSON.stringify(this.movieWishlist));
    }

    saveTvWishlist() {
        localStorage.setItem('tvWishlist', JSON.stringify(this.tvWishlist));
    }

    renderMovieWishlist() {
        const wishlistElement = document.getElementById('movieWishlist');
        this.renderWishlist(wishlistElement, this.movieWishlist, 'movie');
        this.updateMovieCount();
    }

    renderTvWishlist() {
        const wishlistElement = document.getElementById('tvWishlist');
        this.renderWishlist(wishlistElement, this.tvWishlist, 'tv');
        this.updateTvCount();
    }

    renderWishlist(element, wishlist, type) {
        if (wishlist.length === 0) {
            const contentType = type === 'movie' ? 'movies' : 'TV shows';
            element.innerHTML = `<p class="empty-message">No ${contentType} in your wishlist yet. Search to add some!</p>`;
            return;
        }

        // Filter by genre if active
        let filteredItems = wishlist;
        if (this.activeGenreFilter) {
            filteredItems = wishlist.filter(item => 
                Array.isArray(item.genres) && item.genres.some(genre => 
                    genre.toLowerCase() === this.activeGenreFilter.toLowerCase()
                )
            );
        }

        // Show filter status and clear option
        if (this.activeGenreFilter) {
            const filterInfo = document.createElement('div');
            filterInfo.className = 'genre-filter-info';
            filterInfo.innerHTML = `
                <div class="filter-active">
                    <span>Filtering by: <strong>${this.activeGenreFilter}</strong> (${filteredItems.length} items)</span>
                    <button class="clear-filter-btn" onclick="movieLibrary.clearGenreFilter()">✕ Clear Filter</button>
                </div>
            `;
            element.parentNode.insertBefore(filterInfo, element);
        }

        if (filteredItems.length === 0 && this.activeGenreFilter) {
            element.innerHTML = `<p class="empty-message">No items found with genre "${this.activeGenreFilter}". <button class="clear-filter-btn" onclick="movieLibrary.clearGenreFilter()">Clear filter</button> to see all items.</p>`;
            return;
        }

        const sortedItems = this.sortWishlist(filteredItems, this.currentSort);

        element.innerHTML = sortedItems.map(item => {
            const genreBadges = Array.isArray(item.genres) && item.genres.length > 0 
                ? item.genres.map(genre => {
                    const isActive = this.activeGenreFilter && genre.toLowerCase() === this.activeGenreFilter.toLowerCase();
                    return `<span class="genre-badge ${isActive ? 'active' : ''}" onclick="movieLibrary.filterByGenre('${genre}')" title="Click to filter by ${genre}">${genre}</span>`;
                }).join('')
                : '<span class="genre-badge no-genre">Unknown Genre</span>';
            
            const removeFunction = type === 'movie' ? 'removeFromMovieWishlist' : 'removeFromTvWishlist';
            const year = type === 'movie' ? item.year : item.first_air_year;
            const extraInfo = type === 'movie' 
                ? `<div class="movie-director"><strong>Director:</strong> ${item.director}</div>
                   <div class="movie-actors"><strong>Starring:</strong> ${item.actors}</div>`
                : `<div class="movie-director"><strong>Creator:</strong> ${item.creator}</div>
                   <div class="movie-actors"><strong>Seasons:</strong> ${item.seasons}</div>`;
            
            return `
                <div class="movie-card">
                    <button class="remove-btn" onclick="movieLibrary.${removeFunction}(${item.id})">×</button>
                    <img src="${item.poster}" alt="${item.title}" class="movie-poster" />
                    <div class="movie-info">
                        <div class="movie-title">${item.title}</div>
                        <div class="movie-year">${year}</div>
                        <div class="movie-genres">
                            <div class="genre-label">Genres:</div>
                            <div class="genre-badges">${genreBadges}</div>
                        </div>
                        ${extraInfo}
                    </div>
                </div>
            `;
        }).join('');
    }

    async removeFromMovieWishlist(movieId) {
        this.movieWishlist = this.movieWishlist.filter(movie => movie.id !== movieId);
        
        // Remove from Supabase if authenticated, otherwise localStorage
        if (this.currentUser && this.supabaseClient) {
            try {
                await this.supabaseClient.removeMovieFromWishlist(movieId);
            } catch (error) {
                console.error('Error removing from Supabase:', error);
                // Fallback to localStorage
                this.saveMovieWishlist();
            }
        } else {
            this.saveMovieWishlist();
        }
        
        this.renderMovieWishlist();
    }

    async removeFromTvWishlist(tvId) {
        this.tvWishlist = this.tvWishlist.filter(show => show.id !== tvId);
        
        // Remove from Supabase if authenticated, otherwise localStorage
        if (this.currentUser && this.supabaseClient) {
            try {
                await this.supabaseClient.removeTvFromWishlist(tvId);
            } catch (error) {
                console.error('Error removing from Supabase:', error);
                // Fallback to localStorage
                this.saveTvWishlist();
            }
        } else {
            this.saveTvWishlist();
        }
        
        this.renderTvWishlist();
    }

    filterByGenre(genre) {
        // Clear any existing filter info elements
        this.clearFilterInfoElements();
        
        if (this.activeGenreFilter === genre) {
            // If clicking the same genre, clear the filter
            this.clearGenreFilter();
        } else {
            // Set new genre filter
            this.activeGenreFilter = genre;
            this.renderMovieWishlist();
            this.renderTvWishlist();
        }
    }

    clearGenreFilter() {
        this.activeGenreFilter = null;
        this.clearFilterInfoElements();
        this.renderMovieWishlist();
        this.renderTvWishlist();
    }

    clearFilterInfoElements() {
        // Remove any existing filter info elements
        const filterInfos = document.querySelectorAll('.genre-filter-info');
        filterInfos.forEach(info => info.remove());
    }

    exportToCSV() {
        // Combine both wishlists
        const combinedData = [];
        
        // Add movies with type indicator
        this.movieWishlist.forEach(movie => {
            combinedData.push({
                type: 'Movie',
                title: movie.title,
                director: movie.director,
                year: movie.year,
                genres: Array.isArray(movie.genres) ? movie.genres.join('; ') : 'Unknown'
            });
        });
        
        // Add TV shows with type indicator
        this.tvWishlist.forEach(show => {
            combinedData.push({
                type: 'TV Show',
                title: show.title,
                director: show.creator, // Use creator for TV shows
                year: show.first_air_year,
                genres: Array.isArray(show.genres) ? show.genres.join('; ') : 'Unknown'
            });
        });
        
        if (combinedData.length === 0) {
            this.showError('No items in your wishlists to export!');
            return;
        }
        
        // Create CSV content
        const headers = ['Type', 'Title', 'Director/Creator', 'Year', 'Genres'];
        const csvContent = [headers.join(',')];
        
        combinedData.forEach(item => {
            // Escape commas and quotes in data
            const row = [
                `"${item.type}"`,
                `"${item.title.replace(/"/g, '""')}"`,
                `"${item.director.replace(/"/g, '""')}"`,
                `"${item.year}"`,
                `"${item.genres.replace(/"/g, '""')}"`
            ];
            csvContent.push(row.join(','));
        });
        
        // Create and download file
        const csvString = csvContent.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `movie-tv-wishlist-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show success message
            const searchResults = document.getElementById('searchResults');
            searchResults.innerHTML = `<div class="loading">✅ Exported ${combinedData.length} items to CSV file!</div>`;
            setTimeout(() => {
                this.clearSearchResults();
            }, 3000);
        }
    }

    async importFromCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            this.showError('Please select a valid CSV file.');
            return;
        }

        this.showLoading();
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '<div class="loading">📤 Importing CSV data...</div>';

        try {
            const text = await this.readFileAsText(file);
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);
            
            if (lines.length < 2) {
                this.showError('CSV file appears to be empty or invalid.');
                return;
            }

            // Parse header and validate format
            const headers = this.parseCSVLine(lines[0]);
            const expectedHeaders = ['Type', 'Title', 'Director/Creator', 'Year', 'Genres'];
            
            if (headers.length < 4 || !headers.includes('Title') || !headers.includes('Type')) {
                this.showError('Invalid CSV format. Expected headers: Type, Title, Director/Creator, Year, Genres');
                return;
            }

            // Parse data rows
            const dataRows = [];
            for (let i = 1; i < lines.length; i++) {
                const row = this.parseCSVLine(lines[i]);
                if (row.length >= 4) {
                    const item = {
                        type: row[0]?.trim(),
                        title: row[1]?.trim(),
                        director: row[2]?.trim(),
                        year: row[3]?.trim(),
                        genres: row[4]?.trim() || 'Unknown'
                    };
                    
                    if (item.title && item.type) {
                        dataRows.push(item);
                    }
                }
            }

            if (dataRows.length === 0) {
                this.showError('No valid data found in CSV file.');
                return;
            }

            // Process imported items
            await this.processImportedItems(dataRows);

        } catch (error) {
            console.error('Import error:', error);
            this.showError('Error reading CSV file. Please check the file format.');
        }

        // Reset file input
        event.target.value = '';
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // Escaped quote
                    current += '"';
                    i += 2;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
                i++;
            } else {
                current += char;
                i++;
            }
        }
        
        result.push(current);
        return result;
    }

    async processImportedItems(dataRows) {
        const results = { added: 0, duplicates: 0, errors: 0 };
        
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = `<div class="loading">🔍 Looking up ${dataRows.length} items...</div>`;

        for (let i = 0; i < dataRows.length; i++) {
            const item = dataRows[i];
            
            try {
                let found = false;
                
                if (item.type === 'Movie') {
                    found = await this.searchMovieForImport(item);
                } else if (item.type === 'TV Show') {
                    found = await this.searchTvShowForImport(item);
                }
                
                if (found) {
                    results.added++;
                } else {
                    results.errors++;
                }
                
                // Update progress
                if ((i + 1) % 5 === 0 || i === dataRows.length - 1) {
                    searchResults.innerHTML = `<div class="loading">🔍 Processed ${i + 1}/${dataRows.length} items...</div>`;
                }
                
            } catch (error) {
                console.error(`Error processing item: ${item.title}`, error);
                results.errors++;
            }
        }

        this.displayImportResults(results);
        this.renderMovieWishlist();
        this.renderTvWishlist();
    }

    async searchMovieForImport(item) {
        try {
            const response = await fetch(`${this.baseUrl}/search/movie?query=${encodeURIComponent(item.title)}&api_key=${this.apiKey}&language=en-US&page=1`);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                // Find best match (preferably by year if provided)
                let bestMatch = data.results[0];
                
                if (item.year && item.year !== 'Unknown') {
                    const yearMatch = data.results.find(movie => {
                        const movieYear = movie.release_date ? new Date(movie.release_date).getFullYear().toString() : '';
                        return movieYear === item.year;
                    });
                    if (yearMatch) bestMatch = yearMatch;
                }

                // Check for duplicates
                const exists = this.movieWishlist.some(movie => movie.id === bestMatch.id);
                if (exists) return false;

                // Get detailed movie info
                const detailsResponse = await fetch(`${this.baseUrl}/movie/${bestMatch.id}?api_key=${this.apiKey}&append_to_response=credits`);
                const details = await detailsResponse.json();

                const movie = {
                    id: details.id,
                    title: details.title,
                    poster: details.poster_path ? `${this.imageBaseUrl}${details.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Image',
                    year: details.release_date ? new Date(details.release_date).getFullYear() : 'Unknown',
                    genres: details.genres ? details.genres.map(g => g.name) : [],
                    director: details.credits?.crew?.find(person => person.job === 'Director')?.name || 'Unknown',
                    actors: details.credits?.cast?.slice(0, 5).map(actor => actor.name).join(', ') || 'Unknown'
                };

                this.movieWishlist.push(movie);
                this.saveMovieWishlist();
                return true;
            }
        } catch (error) {
            console.error('Movie search error:', error);
        }
        return false;
    }

    async searchTvShowForImport(item) {
        try {
            const response = await fetch(`${this.baseUrl}/search/tv?query=${encodeURIComponent(item.title)}&api_key=${this.apiKey}&language=en-US&page=1`);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                // Find best match
                let bestMatch = data.results[0];
                
                if (item.year && item.year !== 'Unknown') {
                    const yearMatch = data.results.find(show => {
                        const showYear = show.first_air_date ? new Date(show.first_air_date).getFullYear().toString() : '';
                        return showYear === item.year;
                    });
                    if (yearMatch) bestMatch = yearMatch;
                }

                // Check for duplicates
                const exists = this.tvWishlist.some(show => show.id === bestMatch.id);
                if (exists) return false;

                // Get detailed TV show info
                const detailsResponse = await fetch(`${this.baseUrl}/tv/${bestMatch.id}?api_key=${this.apiKey}&append_to_response=credits`);
                const details = await detailsResponse.json();

                const tvShow = {
                    id: details.id,
                    title: details.name,
                    poster: details.poster_path ? `${this.imageBaseUrl}${details.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Image',
                    first_air_year: details.first_air_date ? new Date(details.first_air_date).getFullYear() : 'Unknown',
                    genres: details.genres ? details.genres.map(g => g.name) : [],
                    creator: details.created_by?.length > 0 ? details.created_by.map(c => c.name).join(', ') : 'Unknown',
                    seasons: details.number_of_seasons || 'Unknown'
                };

                this.tvWishlist.push(tvShow);
                this.saveTvWishlist();
                return true;
            }
        } catch (error) {
            console.error('TV show search error:', error);
        }
        return false;
    }

    displayImportResults(results) {
        const searchResults = document.getElementById('searchResults');
        const total = results.added + results.duplicates + results.errors;
        
        let message = `<div class="loading">✅ Import Complete!<br>`;
        message += `📊 ${results.added} items added to wishlists<br>`;
        
        if (results.errors > 0) {
            message += `❌ ${results.errors} items could not be found<br>`;
        }
        
        message += `📈 Total processed: ${total}</div>`;
        
        searchResults.innerHTML = message;
        
        setTimeout(() => {
            this.clearSearchResults();
        }, 5000);
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    updateMovieCount() {
        const movieCountElement = document.getElementById('movie-count');
        if (movieCountElement) {
            movieCountElement.textContent = `(${this.movieWishlist.length})`;
        }
    }

    updateTvCount() {
        const tvCountElement = document.getElementById('tv-count');
        if (tvCountElement) {
            tvCountElement.textContent = `(${this.tvWishlist.length})`;
        }
    }

}

// Initialize the app when page loads
let movieLibrary;
document.addEventListener('DOMContentLoaded', () => {
    movieLibrary = new MovieLibrary();
});