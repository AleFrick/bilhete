import { Router } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import os from 'os';
import path from 'path';

import { env } from '../config/env.js';
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
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
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
import { getMe, updateMe, requestEmailChange, confirmEmailChange, deleteAccount } from '../controllers/profileController.js';
import {
  getActiveTerms,
  getTermsStatus,
  acceptTerms,
  getMyAcceptanceHistory,
  adminCreateTerms,
  adminListTerms,
} from '../controllers/lgpdController.js';
import { cleanupExpiredMatchesAndChats } from '../services/expirationService.js';
import { notificationStream, listNotifications, markNotificationsRead } from '../controllers/notificationController.js';
import { presenceStream } from '../controllers/presenceController.js';
import {
  submitRegistration,
  getMyRegistrationStatus,
  listRegistrationMessages,
  sendRegistrationMessage,
  listAdminRegistrationRequests,
  reviewAdminRegistrationRequest,
} from '../controllers/registrationController.js';
import { getRadar, getVenueDetails, getVenueMenu, getPublicVenue, listPeopleInVenue, listVenueCities, listVenues } from '../controllers/venueController.js';
import { adminRequired, authRequired, establishmentRequired } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const upload = multer({
  dest: path.join(os.tmpdir(), 'bilhete-uploads'),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/octet-stream', 'application/x-pbf', 'binary/octet-stream'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.pbf') || file.originalname.endsWith('.osm.pbf')) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo nao permitido. Use arquivo .pbf ou .osm.pbf.'));
    }
  },
});

const router = Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Muitas tentativas de autenticacao. Tente novamente em 15 minutos.',
});

const passwordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Muitas solicitacoes de recuperacao de senha. Tente novamente em 1 hora.',
});

const bilheteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Voce enviou bilhetes demais em pouco tempo. Aguarde um minuto.',
});

const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Muitas mensagens enviadas em pouco tempo. Aguarde um minuto.',
});

const globalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Muitas requisicoes. Aguarde um minuto.',
});

router.use(globalLimiter);

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'bilhete-backend' });
});

router.post('/auth/register', authLimiter, register);
router.post('/auth/login', authLimiter, login);
router.post('/auth/google', authLimiter, loginGoogle);
router.post('/auth/apple', authLimiter, loginApple);
router.post('/auth/facebook', authLimiter, loginFacebook);
router.get('/auth/google/start', startGoogleOAuth);
router.get('/auth/google/callback', googleOAuthCallback);
router.get('/auth/facebook/start', startFacebookOAuth);
router.get('/auth/facebook/callback', facebookOAuthCallback);
router.get('/auth/apple/start', startAppleOAuth);
router.get('/auth/apple/callback', appleOAuthCallback);
router.get('/auth/verify-email', verifyRegistrationEmail);
router.post('/auth/forgot-password', passwordLimiter, forgotPassword);
router.post('/auth/reset-password', passwordLimiter, resetPassword);
router.post('/auth/change-password', authRequired, passwordLimiter, changePassword);
router.post('/auth/logout', authRequired, logout);
router.get('/terms/active', getActiveTerms);
router.get('/terms/status', authRequired, getTermsStatus);
router.post('/terms/accept', authRequired, acceptTerms);
router.get('/terms/history', authRequired, getMyAcceptanceHistory);
router.post('/admin/auth/login', authLimiter, loginAdmin);

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
router.get('/admin/registration-requests', authRequired, adminRequired, listAdminRegistrationRequests);
router.patch('/admin/registration-requests/:requestId', authRequired, adminRequired, reviewAdminRegistrationRequest);
router.get('/admin/terms', authRequired, adminRequired, adminListTerms);
router.post('/admin/terms', authRequired, adminRequired, adminCreateTerms);
router.post('/admin/cleanup-expired', authRequired, adminRequired, async (req, res) => {
  try {
    const result = await cleanupExpiredMatchesAndChats();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao executar limpeza.' });
  }
});
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
router.put('/me/email', authRequired, requestEmailChange);
router.get('/me/email/verify', confirmEmailChange);
router.delete('/me', authRequired, deleteAccount);
router.post('/registration/submit', authRequired, submitRegistration);
router.get('/registration/status', authRequired, getMyRegistrationStatus);
router.get('/registration/:requestId/messages', authRequired, listRegistrationMessages);
router.post('/registration/:requestId/messages', authRequired, sendRegistrationMessage);

router.get('/public/venues/:venueId', getPublicVenue);

router.get('/venues', authRequired, listVenues);
router.get('/venues/cities', authRequired, listVenueCities);
router.get('/venues/:venueId/menu', authRequired, getVenueMenu);
router.get('/venues/:venueId/details', authRequired, getVenueDetails);
router.get('/venues/:venueId/people', authRequired, listPeopleInVenue);
router.get('/venues/:venueId/presence/stream', (req, res, next) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ message: 'Token ausente.' });
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    return presenceStream(req, res);
  } catch {
    return res.status(401).json({ message: 'Token invalido.' });
  }
});
router.get('/radar', authRequired, getRadar);
router.get('/premium/catalog', authRequired, listPremiumCatalog);
router.post('/premium/checkout', authRequired, createPremiumCheckout);
router.post('/premium/orders/:orderId/confirm', authRequired, confirmPremiumOrderPayment);

router.get('/checkins/current', authRequired, getCurrentCheckin);
router.post('/checkins', authRequired, checkin);
router.post('/checkout', authRequired, checkout);

router.post('/bilhetes', authRequired, bilheteLimiter, sendBilhete);
router.get('/bilhetes/inbox', authRequired, inbox);
router.get('/bilhetes/outbox', authRequired, outbox);
router.post('/bilhetes/:id/respond', authRequired, bilheteLimiter, respond);

router.get('/matches', authRequired, listMatches);
router.get('/chats', authRequired, listChats);
router.get('/chats/:chatId/messages', authRequired, getMessages);
router.post('/chats/:chatId/messages', authRequired, chatLimiter, sendMessage);

router.get('/notifications/stream', (req, res, next) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ message: 'Token ausente.' });
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    return notificationStream(req, res);
  } catch {
    return res.status(401).json({ message: 'Token invalido.' });
  }
});
router.get('/notifications', authRequired, listNotifications);
router.post('/notifications/read', authRequired, markNotificationsRead);

export default router;
