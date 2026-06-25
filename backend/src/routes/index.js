import { Router } from 'express';

import { loginAdmin } from '../controllers/adminAuthController.js';
import { geocodeAdminAddress } from '../controllers/adminGeocodeController.js';
import {
  createAdminVenue,
  listAdminVenueLinkRequests,
  listAdminVenueCities,
  listAdminVenues,
  updateAdminVenue,
  updateAdminVenueLinkApproval,
} from '../controllers/adminVenueController.js';
import {
  createEstablishmentAgendaEvent,
  deleteEstablishmentAgendaEvent,
  getEstablishmentAgendaStats,
  getEstablishmentProfile,
  listEstablishmentAgenda,
  listEstablishmentVenueRequests,
  requestNewVenue,
  requestVenueLink,
  searchVenuesForLink,
  updateEstablishmentAgendaEvent,
  upsertEstablishmentProfile,
} from '../controllers/establishmentController.js';
import { login, loginApple, loginGoogle, register } from '../controllers/authController.js';
import { inbox, outbox, respond, sendBilhete } from '../controllers/bilheteController.js';
import { getCurrentCheckin, checkin, checkout } from '../controllers/checkinController.js';
import { getMessages, listChats, listMatches, sendMessage } from '../controllers/chatController.js';
import { getMe, updateMe } from '../controllers/profileController.js';
import { getRadar, getVenueDetails, listPeopleInVenue, listVenues } from '../controllers/venueController.js';
import { adminRequired, authRequired, establishmentRequired } from '../middleware/auth.js';

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
router.get('/admin/venue-link-requests', authRequired, adminRequired, listAdminVenueLinkRequests);
router.post('/admin/venues', authRequired, adminRequired, createAdminVenue);
router.put('/admin/venues/:venueId', authRequired, adminRequired, updateAdminVenue);
router.patch('/admin/venues/:venueId/link-approval', authRequired, adminRequired, updateAdminVenueLinkApproval);
router.get('/admin/geocode', authRequired, adminRequired, geocodeAdminAddress);

router.get('/establishment/profile', authRequired, establishmentRequired, getEstablishmentProfile);
router.put('/establishment/profile', authRequired, establishmentRequired, upsertEstablishmentProfile);
router.get('/establishment/venues/search', authRequired, establishmentRequired, searchVenuesForLink);
router.get('/establishment/venues/requests', authRequired, establishmentRequired, listEstablishmentVenueRequests);
router.post('/establishment/venues/request-new', authRequired, establishmentRequired, requestNewVenue);
router.post('/establishment/venues/request-link', authRequired, establishmentRequired, requestVenueLink);
router.get('/establishment/agenda', authRequired, establishmentRequired, listEstablishmentAgenda);
router.post('/establishment/agenda', authRequired, establishmentRequired, createEstablishmentAgendaEvent);
router.put('/establishment/agenda/:eventId', authRequired, establishmentRequired, updateEstablishmentAgendaEvent);
router.delete('/establishment/agenda/:eventId', authRequired, establishmentRequired, deleteEstablishmentAgendaEvent);
router.get('/establishment/agenda/stats', authRequired, establishmentRequired, getEstablishmentAgendaStats);
router.get('/establishment/geocode', authRequired, establishmentRequired, geocodeAdminAddress);

router.get('/me', authRequired, getMe);
router.put('/me', authRequired, updateMe);

router.get('/venues', authRequired, listVenues);
router.get('/venues/:venueId/details', authRequired, getVenueDetails);
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
