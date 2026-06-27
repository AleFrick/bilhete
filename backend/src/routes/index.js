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
  createEstablishmentMenuItem,
  deleteEstablishmentAgendaEvent,
  deleteEstablishmentMenuItem,
  getEstablishmentAgendaStats,
  getEstablishmentProfile,
  listEstablishmentAgenda,
  listEstablishmentMenuItems,
  listEstablishmentVenueRequests,
  requestNewVenue,
  requestVenueLink,
  searchVenuesForLink,
  updateEstablishmentAgendaEvent,
  updateEstablishmentMenuItem,
  upsertEstablishmentProfile,
} from '../controllers/establishmentController.js';
import {
  appleOAuthCallback,
  facebookOAuthCallback,
  googleOAuthCallback,
  login,
  loginApple,
  loginFacebook,
  loginGoogle,
  register,
  startAppleOAuth,
  startFacebookOAuth,
  startGoogleOAuth,
} from '../controllers/authController.js';
import {
  createAdminSupportTicketMessage,
  createEstablishmentSupportTicket,
  createEstablishmentSupportTicketMessage,
  listAdminSupportTicketMessages,
  listAdminSupportTickets,
  listEstablishmentSupportTicketMessages,
  listEstablishmentSupportTickets,
  updateAdminSupportTicket,
} from '../controllers/supportTicketController.js';
import { inbox, outbox, respond, sendBilhete } from '../controllers/bilheteController.js';
import { getCurrentCheckin, checkin, checkout } from '../controllers/checkinController.js';
import { getMessages, listChats, listMatches, sendMessage } from '../controllers/chatController.js';
import { getMe, updateMe } from '../controllers/profileController.js';
import { getRadar, getVenueDetails, getVenueMenu, listPeopleInVenue, listVenues } from '../controllers/venueController.js';
import { adminRequired, authRequired, establishmentRequired } from '../middleware/auth.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'bilhete-backend' });
});

router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/google', loginGoogle);
router.post('/auth/apple', loginApple);
router.post('/auth/facebook', loginFacebook);
router.get('/auth/google/start', startGoogleOAuth);
router.get('/auth/google/callback', googleOAuthCallback);
router.get('/auth/facebook/start', startFacebookOAuth);
router.get('/auth/facebook/callback', facebookOAuthCallback);
router.get('/auth/apple/start', startAppleOAuth);
router.get('/auth/apple/callback', appleOAuthCallback);
router.post('/admin/auth/login', loginAdmin);

router.get('/admin/venues', authRequired, adminRequired, listAdminVenues);
router.get('/admin/venues/cities', authRequired, adminRequired, listAdminVenueCities);
router.get('/admin/venue-link-requests', authRequired, adminRequired, listAdminVenueLinkRequests);
router.post('/admin/venues', authRequired, adminRequired, createAdminVenue);
router.put('/admin/venues/:venueId', authRequired, adminRequired, updateAdminVenue);
router.patch('/admin/venues/:venueId/link-approval', authRequired, adminRequired, updateAdminVenueLinkApproval);
router.get('/admin/geocode', authRequired, adminRequired, geocodeAdminAddress);
router.get('/admin/support-tickets', authRequired, adminRequired, listAdminSupportTickets);
router.patch('/admin/support-tickets/:ticketId', authRequired, adminRequired, updateAdminSupportTicket);
router.get('/admin/support-tickets/:ticketId/messages', authRequired, adminRequired, listAdminSupportTicketMessages);
router.post('/admin/support-tickets/:ticketId/messages', authRequired, adminRequired, createAdminSupportTicketMessage);

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
router.get('/establishment/menu', authRequired, establishmentRequired, listEstablishmentMenuItems);
router.post('/establishment/menu', authRequired, establishmentRequired, createEstablishmentMenuItem);
router.put('/establishment/menu/:itemId', authRequired, establishmentRequired, updateEstablishmentMenuItem);
router.delete('/establishment/menu/:itemId', authRequired, establishmentRequired, deleteEstablishmentMenuItem);
router.get('/establishment/geocode', authRequired, establishmentRequired, geocodeAdminAddress);
router.get('/establishment/support-tickets', authRequired, establishmentRequired, listEstablishmentSupportTickets);
router.post('/establishment/support-tickets', authRequired, establishmentRequired, createEstablishmentSupportTicket);
router.get('/establishment/support-tickets/:ticketId/messages', authRequired, establishmentRequired, listEstablishmentSupportTicketMessages);
router.post('/establishment/support-tickets/:ticketId/messages', authRequired, establishmentRequired, createEstablishmentSupportTicketMessage);

router.get('/me', authRequired, getMe);
router.put('/me', authRequired, updateMe);

router.get('/venues', authRequired, listVenues);
router.get('/venues/:venueId/menu', authRequired, getVenueMenu);
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
