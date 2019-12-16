FROM openresty/openresty:bionic

COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

COPY nginx_default.conf /etc/nginx/conf.d/default.conf

COPY proxy.conf /etc/nginx/conf.d/proxy.conf

COPY custom.conf /etc/security/limits.d/custom.conf

RUN ulimit -n

EXPOSE 8585