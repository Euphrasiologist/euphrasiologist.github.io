
temp <- read.csv("~/OneDrive - University of Edinburgh/2016_pheotypic_plasticity_euphrasia/Data/Manyhosts.csv")

setDT(temp)
temp <- temp[,.(Host, Standard_corolla_l)]
levels(temp$Host) <- c("Arabidopsis thaliana", "Equisetum arvense", "Festuca rubra",
                       "Holcus lanatus", "Marchantia polymorpha", "No host", "Pinus sylvestris",
                       "Plantago lanceolata", "Trifolium repens")

write(x = jsonlite::toJSON(x = temp[, .(Mean = mean(Standard_corolla_l, na.rm = TRUE), 
                              SEM = sd(Standard_corolla_l, na.rm = TRUE)/sqrt(.N)), by = .(Host)]), 
      file = "./")
