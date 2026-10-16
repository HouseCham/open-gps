package auth

import (
	nethttp "net/http"

	"github.com/Authula/authula/models"
	"github.com/gofiber/fiber/v3/log"

	"github.com/HouseCham/gps-tracker/backend/internal/app/users"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// SignupMirrorHook returns an Authula Hook that mirrors every successful
// email-password sign-up into the local users table. The Authula signup
// is the source of truth for credentials; our local users table is the
// projection for role / FK relationships.
//
// It is also the signup gate (BA-15): signup is invitation-only. The
// only way an external party may self-register is the very first user
// (the bootstrap super_admin); afterwards every account must be created
// by the super_admin through the admin CreateUser endpoint. The gate
// lives here, not in GetOrCreate, because GetOrCreate is also the
// materialization path for legitimate existing users signing in.
//
// The gate reuses GetOrCreate's own atomic first-user decision (BA-12,
// under the bootstrap advisory lock): if the materialized user ends up
// super_admin it was the first signup (allow), otherwise the system
// already had one (reject). This keeps the allow/deny decision atomic
// with the first registration — two racing first signups cannot both
// slip past a separate "is the system empty?" check.
//
// Both gate outcomes fail closed, because the Authula credential is
// created before this after-stage hook runs:
//   - not-the-bootstrap-user → delete the Authula user (kills the
//     credential and its sessions) and soft-delete the local projection,
//     then 403 Handled. A later login finds no Authula user and is
//     refused, so the leftover credential cannot obtain a session.
//   - GetOrCreate error → revoke the Authula user and return 403
//     Handled instead of falling through, so Authula never reports a
//     successful self-signup the gate could not verify.
func SignupMirrorHook(a *Auth, usersSvc *users.Service) models.Hook {
	return models.Hook{
		Stage: models.HookAfter,
		Matcher: func(rc *models.RequestContext) bool {
			return rc.Method == nethttp.MethodPost &&
				rc.Path == BasePath+"/email-password/sign-up" &&
				rc.Actor != nil && rc.Actor.Type == models.ActorUser
		},
		Handler: func(rc *models.RequestContext) error {
			authulaUser, err := a.NewUserLookup().GetByID(rc.Request.Context(), rc.Actor.ID)
			if err != nil {
				// authula signup succeeded, local mirror is non-critical
				log.Error("signup hook: fetch authula user", "err", err)
				return nil
			}
			user, err := usersSvc.GetOrCreate(rc.Request.Context(), authulaUser.Email, authulaUser.Name)
			if err != nil {
				// Fail closed (BA-15): we could not verify whether this
				// is the bootstrap signup, so we must not let Authula
				// report a successful self-signup. Authula created the
				// credential already; revoke it so no dangling account
				// is left behind, then replace the response. Best-effort
				// revoke: if it fails we still fail closed here.
				log.Error("signup hook: mirror to local users", "err", err)
				if derr := a.NewUserLookup().Delete(rc.Request.Context(), rc.Actor.ID); derr != nil {
					log.Error("signup hook: revoke unverified signup", "err", derr)
				}
				rc.SetJSONResponse(nethttp.StatusForbidden, map[string]any{
					"message": "signup could not be verified",
				})
				rc.Handled = true
				return nil
			}
			if user.Role != domain.UserRoleSuperAdmin {
				// Not the bootstrap user → reject the signup. The 403
				// alone would only change the response; Authula has
				// already created the credential, and AuthSession
				// materializes any actor by email on a later login, so
				// the account could still obtain a session as a regular
				// user. Two revokes block that: delete the Authula user
				// (kills the credential and its sessions), and
				// soft-delete the local projection.
				// ponytail: both revokes are best-effort — the 403 below
				// always rejects this response, and a deleted Authula
				// user can no longer authenticate at all.
				if derr := a.NewUserLookup().Delete(rc.Request.Context(), rc.Actor.ID); derr != nil {
					log.Error("signup hook: revoke rejected signup (authula)", "err", derr)
				}
				if err := usersSvc.RejectSignup(rc.Request.Context(), user.ID); err != nil {
					log.Error("signup hook: revoke rejected signup (local)", "err", err)
				}
				log.Warn("signup hook: rejected non-first signup", "email", authulaUser.Email)
				rc.SetJSONResponse(nethttp.StatusForbidden, map[string]any{
					"message": "signup is invitation-only",
				})
				rc.Handled = true
				return nil
			}
			return nil
		},
	}
}
