# Production Postgres with pgvector, built ON THE SAME postgres:16-alpine base the
# live cluster was initialized with. Deliberately NOT the pgvector/pgvector image:
# that one is Debian/glibc, and swapping libc under an existing data volume shifts
# text collation order — silently corrupting every btree index on TEXT columns
# (emails, usernames, tokens) until a full REINDEX. Same base = zero collation risk.
# Published as ghcr.io/<owner>/freelanceai:db-pg16 (a tag of the existing public
# package, so the VPS can pull it without a new package-visibility errand).
FROM postgres:16-alpine

ARG PGVECTOR_VERSION=v0.8.0

# with_llvm=no: the official alpine image is built with JIT/LLVM, so PGXS would
# otherwise call clang to emit bitcode — which build-base doesn't ship (pgvector#815).
RUN apk add --no-cache --virtual .build-deps git build-base \
    && git clone --depth 1 --branch ${PGVECTOR_VERSION} https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make OPTFLAGS="" with_llvm=no \
    && make install with_llvm=no \
    && rm -rf /tmp/pgvector \
    && apk del .build-deps
