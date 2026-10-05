args <- commandArgs(trailingOnly=TRUE)
stopifnot(length(args)==2)
d <- read.csv(args[1], na.strings='')
out <- list()
for (outcome in c('diabetes_pct','diabetes_adjusted','rent_burden_pct','pct_broadband')) {
 x <- if(outcome == 'pct_broadband') 'pct_poverty' else 'median_hh_income'
 step <- if(outcome == 'pct_broadband') 10 else 10000
 a <- d[complete.cases(d[,c(x,outcome,'median_age','pop_density_km2','pop_total','state_name')]) & d$pop_density_km2 > 0 & d$pop_total > 0,]
 for (weight in c('county','population')) for (kind in c('pooled','state','context','state-context')) {
  rhs <- c(x, if(grepl('state',kind)) 'factor(state_name)', if(grepl('context',kind)) c('median_age','log(pop_density_km2)'))
  w <- if(weight == 'county') rep(1,nrow(a)) else a$pop_total
  fit <- lm(reformulate(rhs,outcome), data=a, weights=w)
  out[[length(out)+1]] <- data.frame(outcome=outcome,id=paste(kind,weight,sep='-'),n=nrow(a),slope=coef(fit)[x]*step,first_residual=residuals(fit)[1])
 }
}
write.csv(do.call(rbind,out),args[2],row.names=FALSE)
cat('32 reference fits completed in R',as.character(getRversion()),'\n')
