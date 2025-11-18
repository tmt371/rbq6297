// File: 04-core-code/services/auth-service.js
// [NEW] This is a new service to manage Firebase Authentication.
// [MODIFIED] (第 1 次編修) Added getIdToken import and verifyAuthentication method.

import { auth } from '../config/firebase-config.js';
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail, // [NEW] Import the password reset function
    getIdToken, // [NEW] (第 1 次編修) Import getIdToken
} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { EVENTS } from '../config/constants.js'; // [NEW] (第 1 次編修)

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
     * [NEW] (第 1 次編修)
     * Verifies if the current user's authentication is still valid by forcing a token refresh.
     * If validation fails (e.g., token expired), it logs the user out.
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async verifyAuthentication() {
        if (!auth.currentUser) {
            const msg = 'No active user. Please log in.';
            console.warn(msg);
            // This case might happen if auth state was lost but app is still open
            // Force logout to sync UI
            await this.logout();
            return { success: false, message: msg };
        }

        try {
            // Passing `true` forces a token refresh.
            // If this succeeds, the user is authenticated.
            await getIdToken(auth.currentUser, true);
            // console.log("Token refreshed, auth verified.");
            return { success: true, message: 'Authentication verified.' };
        } catch (error) {
            // This block catches errors if the token is expired and cannot be refreshed.
            console.warn('Authentication verification failed (Token expired or invalid):', error.code);
            const msg = 'Authentication expired. Please log in again.';

            // Since verification failed, force a logout to clear the zombie state.
            await this.logout();

            return { success: false, message: msg };
        }
    }


    /**
     * [NEW] Sends a password reset email to the provided email address.
     * @param {string} email
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async sendPasswordReset(email) {
        if (!email) {
            return { success: false, message: 'Email is required to send a reset link.' };
        }
        try {
            await sendPasswordResetEmail(auth, email);
            console.log('Password reset email sent to:', email);
            return { success: true, message: `Password reset link sent to ${email}. Please check your inbox.` };
        } catch (error) {
            console.error('Password reset failed:', error.code, error.message);
            const friendlyMessage = this._mapErrorToMessage(error.code);
            return { success: false, message: friendlyMessage };
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