import { Router } from 'express';

import { loginAdmin } from '../controllers/adminAuthController.js';
import { geocodeAdminAddress } from '../controllers/adminGeocodeController.js';
import { createAdminVenue, listAdminVenueCities, listAdminVenues, updateAdminVenue } from '../controllers/adminVenueController.js';
import { login, loginApple, loginGoogle, register } from '../controllers/authController.js';
import { inbox, outbox, respond, sendBilhete } from '../controllers/bilheteController.js';
import { getCurrentCheckin, checkin, checkout } from '../controllers/checkinController.js';
import { getMessages, listChats, listMatches, sendMessage } from '../controllers/chatController.js';
import { getMe, updateMe } from '../controllers/profileController.js';
import { getRadar, listPeopleInVenue, listVenues } from '../controllers/venueController.js';
import { adminRequired, authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'bilhete-backend' });
});

router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/google', loginGoogle);
router.post('/auth/apple', loginApple);
router.post('/admin/auth/login', loginAdmin);

router.get('/admin/venues', authRequired, adminRequired, listAdminVenues);
router.get('/admin/venues/cities', authRequired, adminRequired, listAdminVenueCities);
router.post('/admin/venues', authRequired, adminRequired, createAdminVenue);
router.put('/admin/venues/:venueId', authRequired, adminRequired, updateAdminVenue);
router.get('/admin/geocode', authRequired, adminRequired, geocodeAdminAddress);

router.get('/me', authRequired, getMe);
router.put('/me', authRequired, updateMe);

router.get('/venues', authRequired, listVenues);
router.get('/venues/:venueId/people', authRequired, listPeopleInVenue);
router.get('/radar', authRequired, getRadar);

router.get('/checkins/current', authRequired, getCurrentCheckin);
router.post('/checkins', authRequired, checkin);
router.post('/checkout', authRequired, checkout);

router.post('/bilhetes', authRequired, sendBilhete);
router.get('/bilhetes/inbox', authRequired, inbox);
router.get('/bilhetes/outbox', authRequired, outbox);
router.post('/bilhetes/:id/respond', authRequired, respond);

router.get('/matches', authRequired, listMatches);
router.get('/chats', authRequired, listChats);
router.get('/chats/:chatId/messages', authRequired, getMessages);
router.post('/chats/:chatId/messages', authRequired, sendMessage);

export default router;
