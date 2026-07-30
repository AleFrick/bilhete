import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';

import { loginAdmin } from '../controllers/adminAuthController.js';
import { geocodeAdminAddress } from '../controllers/adminGeocodeController.js';
import { importPbfVenues } from '../controllers/adminImportController.js';
import {
  getPaymentSettings,
  updatePaymentSettings,
  asaasWebhook,
} from '../controllers/adminPaymentController.js';
import {
  batchCreateVenues,
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
  getEstablishmentDashboard,
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
  verifyRegistrationEmail,
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
import {
  confirmPremiumOrderPayment,
  createAdminPremiumCoupon,
  createAdminPremiumPackage,
  createAdminPremiumPromotion,
  createPremiumCheckout,
  listAdminPremiumCoupons,
  listAdminPremiumPackages,
  listAdminPremiumPromotions,
  listPremiumCatalog,
  updateAdminPremiumCoupon,
  updateAdminPremiumPackage,
  updateAdminPremiumPromotion,
} from '../controllers/premiumController.js';
import { getMe, updateMe } from '../controllers/profileController.js';
import { getRadar, getVenueDetails, getVenueMenu, listPeopleInVenue, listVenues } from '../controllers/venueController.js';
import { adminRequired, authRequired, establishmentRequired } from '../middleware/auth.js';

const upload = multer({
  dest: path.join(os.tmpdir(), 'bilhete-uploads'),
  limits: { fileSize: 1024 * 1024 * 1024 },
});

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
router.get('/auth/verify-email', verifyRegistrationEmail);
router.post('/admin/auth/login', loginAdmin);

router.get('/admin/venues', authRequired, adminRequired, listAdminVenues);
router.get('/admin/venues/cities', authRequired, adminRequired, listAdminVenueCities);
router.get('/admin/venue-link-requests', authRequired, adminRequired, listAdminVenueLinkRequests);
router.post('/admin/venues', authRequired, adminRequired, createAdminVenue);
router.post('/admin/venues/batch', authRequired, adminRequired, batchCreateVenues);
router.put('/admin/venues/:venueId', authRequired, adminRequired, updateAdminVenue);
router.patch('/admin/venues/:venueId/link-approval', authRequired, adminRequired, updateAdminVenueLinkApproval);
router.get('/admin/geocode', authRequired, adminRequired, geocodeAdminAddress);
router.get('/admin/support-tickets', authRequired, adminRequired, listAdminSupportTickets);
router.patch('/admin/support-tickets/:ticketId', authRequired, adminRequired, updateAdminSupportTicket);
router.get('/admin/support-tickets/:ticketId/messages', authRequired, adminRequired, listAdminSupportTicketMessages);
router.post('/admin/support-tickets/:ticketId/messages', authRequired, adminRequired, createAdminSupportTicketMessage);
router.get('/admin/premium/packages', authRequired, adminRequired, listAdminPremiumPackages);
router.post('/admin/premium/packages', authRequired, adminRequired, createAdminPremiumPackage);
router.put('/admin/premium/packages/:packageId', authRequired, adminRequired, updateAdminPremiumPackage);
router.get('/admin/premium/coupons', authRequired, adminRequired, listAdminPremiumCoupons);
router.post('/admin/premium/coupons', authRequired, adminRequired, createAdminPremiumCoupon);
router.put('/admin/premium/coupons/:couponId', authRequired, adminRequired, updateAdminPremiumCoupon);
router.get('/admin/premium/promotions', authRequired, adminRequired, listAdminPremiumPromotions);
router.post('/admin/premium/promotions', authRequired, adminRequired, createAdminPremiumPromotion);
router.put('/admin/premium/promotions/:promotionId', authRequired, adminRequired, updateAdminPremiumPromotion);
router.post('/admin/import/pbf', authRequired, adminRequired, upload.single('file'), importPbfVenues);
router.get('/admin/payment/settings', authRequired, adminRequired, getPaymentSettings);
router.put('/admin/payment/settings', authRequired, adminRequired, updatePaymentSettings);
router.post('/webhooks/asaas', asaasWebhook);

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
router.get('/establishment/dashboard', authRequired, establishmentRequired, getEstablishmentDashboard);
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
router.get('/premium/catalog', authRequired, listPremiumCatalog);
router.post('/premium/checkout', authRequired, createPremiumCheckout);
router.post('/premium/orders/:orderId/confirm', authRequired, confirmPremiumOrderPayment);

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
