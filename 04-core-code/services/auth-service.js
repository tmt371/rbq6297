// File: 04-core-code/services/auth-service.js
// [NEW] This is a new service to manage Firebase Authentication.

import { auth } from '../config/firebase-config.js';
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';

/**
 * @fileoverview Service for managing user authentication,
 * including login, logout, and observing auth state changes.
 */
export class AuthService {
    constructor(eventAggregator) {
        this.eventAggregator = eventAggregator;
        this.currentUser = null;
        console.log("AuthService Initialized.");
    }

    /**
     * Attempts to sign in the user with email and password.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async login(email, password) {
        if (!email || !password) {
            return { success: false, message: 'Email and password are required.' };
        }
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            this.currentUser = userCredential.user;
            console.log('Login successful:', this.currentUser.uid);
            return { success: true, message: 'Login successful!' };
        } catch (error) {
            console.error('Login failed:', error.code, error.message);
            const friendlyMessage = this._mapErrorToMessage(error.code);
            return { success: false, message: friendlyMessage };
        }
    }

    /**
     * Signs out the current user.
     */
    async logout() {
        try {
            await signOut(auth);
            this.currentUser = null;
            console.log('Logout successful.');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    /**
     * Attaches a listener to Firebase Auth state changes.
     * This is the primary way the app knows if a user is logged in or out.
     * @param {function} onUserLoggedIn - Callback when a user is found (passes user object).
     * @param {function} onUserLoggedOut - Callback when no user is found.
     */
    observeAuthState(onUserLoggedIn, onUserLoggedOut) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is signed in
                this.currentUser = user;
                onUserLoggedIn(user);
            } else {
                // User is signed out
                this.currentUser = null;
                onUserLoggedOut();
            }
        });
    }

    /**
     * Converts Firebase error codes into user-friendly messages.
     * @param {string} errorCode
     * @returns {string}
     * @private
     */
    _mapErrorToMessage(errorCode) {
        switch (errorCode) {
            case 'auth/invalid-email':
                return 'Invalid email format.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return 'Invalid email or password.';
            case 'auth/too-many-requests':
                return 'Access temporarily disabled due to too many failed attempts. Please reset your password or try again later.';
            default:
                return 'An unknown error occurred during login.';
        }
    }
}