if sudo -u postgres pg_isready -q; then
    echo "VITO_FENCE=$(sudo -u postgres psql -XtAc 'SELECT pg_is_in_recovery()')"
else
    echo "VITO_FENCE=down"
fi
