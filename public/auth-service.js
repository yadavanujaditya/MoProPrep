// --- Auth Service ---

const AuthService = {
    user: null,
    loginInProgress: false,
    userDocListener: null,

    // Initialize Auth Listener
    init(onUserChanged) {
        auth.onAuthStateChanged(async (firebaseUser) => {
            // Clean up previous listener
            if (this.userDocListener) {
                this.userDocListener();
                this.userDocListener = null;
            }

            if (firebaseUser) {
                // Set up real-time listener on user document
                this.userDocListener = db.collection('users').doc(firebaseUser.uid).onSnapshot(async (doc) => {
                    let userData = doc.exists ? doc.data() : null;

                    if (!userData) {
                        // Create basic user profile in Firestore if first time
                        userData = {
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName,
                            isPro: false,
                            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        try {
                            await db.collection('users').doc(firebaseUser.uid).set(userData);
                        } catch (err) {
                            console.error("Failed to create user doc:", err);
                        }
                    }

                    this.user = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        ...userData
                    };

                    // --- ADMIN BACKDOOR: Auto-Grant Pro to Admin ---
                    if (this.user.email === "adityasonofashok@gmail.com" && !this.user.isPro) {
                        console.log("Admin User Detected: Auto-Granting Pro Status...");
                        this.user.isPro = true;
                        // Persist to Firestore
                        db.collection('users').doc(firebaseUser.uid).update({ isPro: true })
                            .catch(e => console.error("Admin auto-grant failed:", e));
                    }

                    console.log("User data updated:", this.user.email, "isPro:", this.user.isPro);
                    this.loginInProgress = false;
                    if (onUserChanged) onUserChanged(this.user);
                }, (error) => {
                    console.error("User doc listener error:", error);
                    this.user = firebaseUser;
                    this.loginInProgress = false;
                    if (onUserChanged) onUserChanged(this.user);
                });
            } else {
                this.user = null;
                this.loginInProgress = false;
                if (onUserChanged) onUserChanged(this.user);
            }
        });
    },

    // Trigger Google login via Modal
    login() {
        return new Promise((resolve) => {
            // Prevent multiple popup attempts
            if (this.loginInProgress) {
                console.log("Login already in progress...");
                const checkUser = setInterval(() => {
                    if (!this.loginInProgress && this.user) {
                        clearInterval(checkUser);
                        resolve(this.user);
                    }
                }, 100);
                return;
            }

            // Show Login Modal
            const modal = document.getElementById('login-modal');
            const googleBtn = document.getElementById('btn-google-login');
            const cancelBtn = document.getElementById('btn-close-login');

            if (!modal || !googleBtn) {
                console.error("Login modal elements not found!");
                resolve(null);
                return;
            }

            modal.style.display = 'flex';

            // Handle Cancel
            const closeModal = () => {
                modal.style.display = 'none';
                resolve(null);
            };
            cancelBtn.onclick = closeModal;
            modal.onclick = (e) => { if (e.target === modal) closeModal(); }; // Click outside

            // Handle Google Sign In
            googleBtn.onclick = async () => {
                this.loginInProgress = true;
                try {
                    await auth.signInWithPopup(provider);
                    // Wait for onAuthStateChanged to populate this.user
                    const checkUser = setInterval(() => {
                        if (this.user && this.user.email) {
                            clearInterval(checkUser);
                            this.loginInProgress = false;
                            modal.style.display = 'none';
                            resolve(this.user);
                        }
                    }, 100);
                    // Timeout after 10 seconds
                    setTimeout(() => {
                        clearInterval(checkUser);
                        this.loginInProgress = false;
                        modal.style.display = 'none';
                        resolve(this.user);
                    }, 10000);
                } catch (error) {
                    this.loginInProgress = false;
                    console.error("Login failed:", error.message, error.code);
                    if (error.code === 'auth/popup-closed-by-user') {
                        console.log("User closed login popup.");
                    } else {
                        alert("Login failed: " + error.message);
                    }
                    modal.style.display = 'none';
                    resolve(null);
                }
            };
        });
    },

    // Logout
    async logout() {
        if (this.userDocListener) {
            this.userDocListener();
            this.userDocListener = null;
        }
        await auth.signOut();
        window.location.reload();
    },

    // Helper: Is Logged In?
    isLoggedIn() {
        return !!this.user;
    },

    // Helper: Is Pro?
    isPro() {
        const isPro = this.user && this.user.isPro === true;
        console.log("Checking isPro:", isPro, "user.isPro:", this.user?.isPro);
        return isPro;
    }
};
