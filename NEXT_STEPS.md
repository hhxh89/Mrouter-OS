# Next steps

1. Run `./validate-source.sh` on this source bundle.
2. Build all five APKs on the OpenWrt 25.12.5 build VM with `JOBS=4 ./build-packages.sh ~/openwrt-x86/source`.
3. Verify `~/mrouter-v1-packages/` contains exactly five APKs plus `SHA256SUMS`.
4. Roll VM109 back to the clean OpenWrt 25.12.5 snapshot instead of trying to downgrade from the earlier 12.0.0-rc3 package version.
5. Install v1.0.0 fresh and run the checklist in `TESTING.md`.
6. Fix only issues reproduced in that test; avoid full firmware rebuilds for UI/backend package changes.
7. After the candidate passes, sanitize and push the canonical source tree to the private GitHub repository.
