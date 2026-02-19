from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialized limiter
# key_func=get_remote_address means we limit the rate based on the remote address
limiter = Limiter(key_func=get_remote_address)
